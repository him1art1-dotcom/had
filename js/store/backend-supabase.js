function ready(){
  return !!(window.sb && window.SB_URL && window.SB_ANON);
}
function schoolId(){
  const sess = (()=>{ try{return JSON.parse(localStorage.getItem('hader:auth:session'))}catch{ return null }})();
  return (sess && sess.school_id) || localStorage.getItem('hader:school_id') || 'school_1';
}

export default {
  name: 'supabase',
  describe(){ return ready()? {ready:true}:{ready:false, reason:'Supabase غير مهيأ'}; },
  async init(){ if(!ready()) throw new Error('Supabase غير مهيأ'); },

  // إعدادات عامة محفوظة في جدول settings { school_id, key, value(json) }
  async getSettings(){
    const sid = schoolId();
    const { data, error } = await window.sb.from('settings')
      .select('key,value').eq('school_id', sid);
    if (error) throw error;
    const obj = {};
    (data||[]).forEach(r => obj[r.key] = r.value);
    return obj;
  },
  async setSettings(patch){
    const sid = schoolId();
    const rows = Object.keys(patch).map(k => ({ school_id: sid, key:k, value:patch[k] }));
    const { error } = await window.sb.from('settings')
      .upsert(rows, { onConflict: 'school_id,key' });
    if (error) throw error;
    return this.getSettings();
  },

  // طلبات الاستئذان
  async createLeaveRequest({ studentId, reason, note, at }){
    const sid = schoolId();
    const payload = {
      school_id: sid,
      student_id: studentId,
      reason, note,
      date: (at || new Date()).toISOString().slice(0,10)
    };
    const { error } = await window.sb.from('leave_requests')
      .insert(payload);
    if (error) throw error;
    return true;
  },
  async fetchLeaveRequests({ from, to }){
    const sid = schoolId();
    let q = window.sb.from('leave_requests').select('*').eq('school_id', sid);
    if (from) q = q.gte('date', from);
    if (to)   q = q.lte('date', to);
    const { data, error } = await q.order('created_at', { ascending: true });
    if (error) throw error;
    return data||[];
  },

  // الحضور
  async fetchAttendance({ date, filters }){
    const sid = schoolId();
    let q = window.sb.from('attendance').select('*').eq('school_id', sid);
    if (date) q = q.eq('date', date);
    if (filters?.status?.length) q = q.in('status', filters.status);
    const { data, error } = await q.order('created_at', { ascending: true });
    if (error) throw error;
    return data||[];
  }
};
