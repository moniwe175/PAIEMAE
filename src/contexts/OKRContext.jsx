import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  fetchCycles, 
  fetchOkrDataForCycle, 
  createObjective, 
  createKeyResult, 
  createTask as apiCreateTask, 
  updateTask as apiUpdateTask, 
  moveTaskColumn as apiMoveTaskColumn, 
  deleteTask as apiDeleteTask 
} from '../services/okrService';

// ─── MONTH CONFIG ───────────────────────────────────────────────────────────────
// We use these static dates for the Kanban calculations (day 1 to 30)
const CURRENT_DAY = 15;
const TOTAL_DAYS = 30;

// ─── CONTEXT ────────────────────────────────────────────────────────────────────
const OKRContext = createContext(null);

export function OKRProvider({ children }) {
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [okrData, setOkrData] = useState([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Cycles on mount
  useEffect(() => {
    let active = true;
    const loadCycles = async () => {
      setLoading(true);
      const data = await fetchCycles();
      if (active) {
        setCycles(data);
        if (data.length > 0) {
          // Defaults to the most recent (active) cycle
          setSelectedCycle(data[0]);
        }
        setLoading(false);
      }
    };
    loadCycles();
    return () => { active = false; };
  }, []);

  // 2. Fetch OKRs when selectedCycle changes
  useEffect(() => {
    let active = true;
    const loadOkrData = async () => {
      if (!selectedCycle) {
        setOkrData([]);
        return;
      }
      setLoading(true);
      const tree = await fetchOkrDataForCycle(selectedCycle.id);
      if (active) {
        setOkrData(tree);
        setLoading(false);
      }
    };
    loadOkrData();
    return () => { active = false; };
  }, [selectedCycle]);

  // ── Task Operations ──────────────────────────────────────────
  const moveTask = useCallback(async (krId, taskId, newColumn) => {
    // Optimistic UI update
    setOkrData(prev => prev.map(obj => ({
      ...obj,
      keyResults: obj.keyResults.map(kr => {
        if (kr.id !== krId) return kr;
        return {
          ...kr,
          tasks: kr.tasks.map(t => t.id === taskId ? { ...t, column: newColumn } : t)
        };
      })
    })));

    // API Call
    await apiMoveTaskColumn(taskId, newColumn);
  }, []);

  const addTask = useCallback(async (krId, taskData) => {
    // API Call
    const { data, error } = await apiCreateTask({ ...taskData, kr_id: krId });
    if (error || !data) return;

    // Update UI
    setOkrData(prev => prev.map(obj => ({
      ...obj,
      keyResults: obj.keyResults.map(kr =>
        kr.id === krId ? { ...kr, tasks: [...kr.tasks, data] } : kr
      )
    })));
  }, []);

  const updateTask = useCallback(async (krId, taskId, updates) => {
    // API Call
    const { data, error } = await apiUpdateTask(taskId, updates);
    if (error || !data) return;

    // Update UI
    setOkrData(prev => prev.map(obj => ({
      ...obj,
      keyResults: obj.keyResults.map(kr =>
        kr.id === krId
          ? { ...kr, tasks: kr.tasks.map(t => t.id === taskId ? data : t) }
          : kr
      )
    })));
  }, []);

  const deleteTask = useCallback(async (krId, taskId) => {
    // Optimistic UI update
    setOkrData(prev => prev.map(obj => ({
      ...obj,
      keyResults: obj.keyResults.map(kr =>
        kr.id === krId
          ? { ...kr, tasks: kr.tasks.filter(t => t.id !== taskId) }
          : kr
      )
    })));

    // API Call
    await apiDeleteTask(taskId);
  }, []);

  // ── Key Result Operations (Simulated logic, easily connected to Supabase)
  const addKeyResult = useCallback(async (objId, krData) => {
    // API Call
    const { data, error } = await createKeyResult({ ...krData, objective_id: objId });
    if (error || !data) return;
    
    const newKR = { ...data, tasks: [] };
    
    // Update UI
    setOkrData(prev => prev.map(obj =>
      obj.id === objId
        ? { ...obj, keyResults: [...obj.keyResults, newKR] }
        : obj
    ));
  }, []);

  const updateKeyResult = useCallback((objId, krId, updates) => {
    // Optimistic UI only for now (unless we need full CRUD for KRs in UI)
    setOkrData(prev => prev.map(obj =>
      obj.id === objId
        ? {
            ...obj,
            keyResults: obj.keyResults.map(kr =>
              kr.id === krId ? { ...kr, ...updates } : kr
            )
          }
        : obj
    ));
  }, []);

  return (
    <OKRContext.Provider value={{
      okrData,
      loading,
      cycles,
      selectedCycle,
      setSelectedCycle,
      currentDay: CURRENT_DAY,
      totalDays: TOTAL_DAYS,
      currentMonth: selectedCycle?.name || 'N/A',
      moveTask,
      addTask,
      updateTask,
      deleteTask,
      addKeyResult,
      updateKeyResult
    }}>
      {children}
    </OKRContext.Provider>
  );
}

export function useOKR() {
  const ctx = useContext(OKRContext);
  if (!ctx) throw new Error('useOKR must be used within OKRProvider');
  return ctx;
}
