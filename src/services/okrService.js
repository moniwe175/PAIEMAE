import { supabase } from '../lib/supabase';

// ─── STICKY NOTES (Dashboard manual notes) ──────────────────────────────────

export async function fetchStickyNotes() {
  const { data, error } = await supabase
    .from('sticky_notes')
    .select('*')
    .eq('dismissed', false)
    .order('ordem', { ascending: true });
  if (error) console.error('Error fetching sticky_notes:', error);
  return { data, error };
}

export async function insertStickyNote(note) {
  const { data, error } = await supabase
    .from('sticky_notes')
    .insert([note])
    .select()
    .single();
  if (error) console.error('Error inserting sticky_note:', error);
  return { data, error };
}

export async function updateStickyNote(id, updates) {
  const { data, error } = await supabase
    .from('sticky_notes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) console.error('Error updating sticky_note:', error);
  return { data, error };
}

export async function deleteStickyNote(id) {
  const { error } = await supabase
    .from('sticky_notes')
    .delete()
    .eq('id', id);
  if (error) console.error('Error deleting sticky_note:', error);
  return { error };
}

// ─── FETCH ACTIVE OKR TASKS FOR DASHBOARD ────────────────────────────────────
// Returns all non-done tasks from the currently active cycle,
// with enough context to generate priority sticky notes.
export async function fetchActiveOKRTasks() {
  // 1. Find the active cycle
  const { data: cycle, error: cycleError } = await supabase
    .from('okr_cycles')
    .select('id, name, start_date, end_date')
    .eq('is_active', true)
    .single();
  if (cycleError || !cycle) return { data: [], cycle: null };

  // 2. Fetch objectives in that cycle
  const { data: objectives, error: objError } = await supabase
    .from('okr_objectives')
    .select('id')
    .eq('cycle_id', cycle.id);
  if (objError || !objectives?.length) return { data: [], cycle };

  const objectiveIds = objectives.map(o => o.id);

  // 3. Fetch key results
  const { data: krs, error: krError } = await supabase
    .from('okr_key_results')
    .select('id, name')
    .in('objective_id', objectiveIds);
  if (krError || !krs?.length) return { data: [], cycle };

  const krIds = krs.map(kr => kr.id);
  const krMap = Object.fromEntries(krs.map(kr => [kr.id, kr]));

  // 4. Fetch non-done tasks
  const { data: tasks, error: taskError } = await supabase
    .from('okr_tasks')
    .select('id, title, assignee, due_day, status_column, kr_id')
    .in('kr_id', krIds)
    .neq('status_column', 'done');
  if (taskError) return { data: [], cycle };

  // Enrich tasks with KR name
  const enriched = (tasks || []).map(t => ({
    ...t,
    dueDay: t.due_day,
    krName: krMap[t.kr_id]?.name || '',
  }));

  return { data: enriched, cycle };
}

// ─── CYCLES ─────────────────────────────────────────────────────────────────

export async function fetchCycles() {
  const { data, error } = await supabase
    .from('okr_cycles')
    .select('*')
    .order('start_date', { ascending: false });
  if (error) {
    console.error('Error fetching okr_cycles:', error);
    return [];
  }
  return data;
}

export async function fetchActiveCycle() {
  const { data, error } = await supabase
    .from('okr_cycles')
    .select('*')
    .eq('is_active', true)
    .single();
  if (error) {
    console.error('Error fetching active okr_cycle:', error);
    return null;
  }
  return data;
}

export async function createCycle(cycleData) {
  const { data, error } = await supabase
    .from('okr_cycles')
    .insert([cycleData])
    .select()
    .single();
  if (error) {
    console.error('Error creating okr_cycle:', error);
    return null;
  }
  return data;
}

// ─── OBJECTIVES, KEY RESULTS & TASKS ────────────────────────────────────────

// Fetch everything nested for a specific cycle
export async function fetchOkrDataForCycle(cycleId) {
  if (!cycleId) return [];

  // 1. Fetch objectives
  const { data: objectives, error: objError } = await supabase
    .from('okr_objectives')
    .select('*')
    .eq('cycle_id', cycleId)
    .order('created_at', { ascending: true });
    
  if (objError) {
    console.error('Error fetching okr_objectives:', objError);
    return [];
  }

  if (objectives.length === 0) return [];

  const objectiveIds = objectives.map(o => o.id);

  // 2. Fetch Key Results
  const { data: krs, error: krError } = await supabase
    .from('okr_key_results')
    .select('*')
    .in('objective_id', objectiveIds)
    .order('created_at', { ascending: true });

  if (krError) {
    console.error('Error fetching okr_key_results:', krError);
    return [];
  }

  const krIds = krs.map(kr => kr.id);

  // 3. Fetch Tasks
  let tasks = [];
  if (krIds.length > 0) {
    const { data: t, error: tError } = await supabase
      .from('okr_tasks')
      .select('*')
      .in('kr_id', krIds)
      .order('due_day', { ascending: true });
    if (tError) {
      console.error('Error fetching okr_tasks:', tError);
    } else {
      tasks = t;
    }
  }

  // Assemble the tree
  const tree = objectives.map(obj => {
    const objKrs = krs.filter(kr => kr.objective_id === obj.id).map(kr => {
      // Map tasks, ensuring we use 'column' instead of 'status_column' for frontend compatibility
      const krTasks = tasks.filter(t => t.kr_id === kr.id).map(t => ({
        ...t,
        column: t.status_column,
        dueDay: t.due_day
      }));
      return { ...kr, tasks: krTasks };
    });
    return { ...obj, keyResults: objKrs };
  });

  return tree;
}

// ─── MUTATIONS ──────────────────────────────────────────────────────────────

export async function createObjective(objectiveData) {
  const { data, error } = await supabase
    .from('okr_objectives')
    .insert([objectiveData])
    .select()
    .single();
  if (error) console.error('Error creating objective:', error);
  return { data, error };
}

export async function createKeyResult(krData) {
  const { data, error } = await supabase
    .from('okr_key_results')
    .insert([krData])
    .select()
    .single();
  if (error) console.error('Error creating key result:', error);
  return { data, error };
}

export async function updateKeyResult(krId, updates) {
  const { data, error } = await supabase
    .from('okr_key_results')
    .update(updates)
    .eq('id', krId)
    .select()
    .single();
  if (error) console.error('Error updating key result:', error);
  return { data, error };
}

export async function createTask(taskData) {
  // Map frontend fields to db fields
  const dbTask = {
    kr_id: taskData.kr_id,
    title: taskData.title,
    assignee: taskData.assignee,
    due_day: taskData.dueDay,
    status_column: taskData.column || 'todo'
  };

  const { data, error } = await supabase
    .from('okr_tasks')
    .insert([dbTask])
    .select()
    .single();
  if (error) console.error('Error creating task:', error);
  
  if (data) {
    return { data: { ...data, column: data.status_column, dueDay: data.due_day }, error };
  }
  return { data, error };
}

export async function updateTask(taskId, updates) {
  // Map frontend fields to db fields if they exist
  const dbUpdates = { ...updates };
  if (dbUpdates.column) {
    dbUpdates.status_column = dbUpdates.column;
    delete dbUpdates.column;
  }
  if (dbUpdates.dueDay) {
    dbUpdates.due_day = dbUpdates.dueDay;
    delete dbUpdates.dueDay;
  }

  const { data, error } = await supabase
    .from('okr_tasks')
    .update(dbUpdates)
    .eq('id', taskId)
    .select()
    .single();
  if (error) console.error('Error updating task:', error);
  
  if (data) {
    return { data: { ...data, column: data.status_column, dueDay: data.due_day }, error };
  }
  return { data, error };
}

export async function moveTaskColumn(taskId, newColumn) {
  const { data, error } = await supabase
    .from('okr_tasks')
    .update({ status_column: newColumn })
    .eq('id', taskId)
    .select()
    .single();
  if (error) console.error('Error moving task:', error);
  return { data, error };
}

export async function deleteTask(taskId) {
  const { error } = await supabase
    .from('okr_tasks')
    .delete()
    .eq('id', taskId);
  if (error) console.error('Error deleting task:', error);
  return { error };
}
