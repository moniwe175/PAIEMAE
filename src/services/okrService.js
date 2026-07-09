import { supabase } from '../lib/supabase';

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
