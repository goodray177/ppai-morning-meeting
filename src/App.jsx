
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  query, 
  deleteDoc, 
  updateDoc, 
  writeBatch
} from 'firebase/firestore';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  UserPlus, 
  PieChart, 
  Trash2, 
  XCircle,
  Clock,
  ChevronRight,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Link as LinkIcon,
  Edit3,
  Check,
  AlertCircle,
  RotateCcw,
  Mail,
  ArrowRight,
  UserCheck,
  ListFilter,
  X,
  UserMinus,
  Activity,
  Database,
  Upload,
  FileJson,
  Dices,
  UserX,
  Save,
  FileSpreadsheet,
  Lock
} from 'lucide-react';

// --- Firebase 配置 ---
// 若在外部環境 (如 GitHub Pages) 執行，請填寫您的 Firebase 專案設定
const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config)
  : {
      apiKey: "AIzaSyA47auVizhYwscm0zCR4krZY40hnTQxoRQ",
      authDomain: "ppai-a05c6.firebaseapp.com",
      projectId: "ppai-a05c6",
      storageBucket: "ppai-a05c6.firebasestorage.app",
      messagingSenderId: "479334053111",
      appId: "1:479334053111:web:99a1a305a993d886ed0ff2",
      measurementId: "G-W35LWQ4Z6B"
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ai-morning-meeting-app';

// --- 台灣 2026 國定假日清單 ---
const TAIWAN_HOLIDAYS_2026 = [
  "2026-05-01", "2026-06-19", "2026-09-25", "2026-10-09", "2026-10-10"
];

// --- 輔助函式 ---
const getTodayStr = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatTime = (isoStr) => {
  if (!isoStr) return "--:--";
  return new Date(isoStr).toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getMonthName = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split('-');
  return `${parts[0]}年 ${parseInt(parts[1])}月`;
};

const getAllSessions = () => {
  const sessions = [];
  const currentYear = new Date().getFullYear();
  const start = new Date(currentYear, 3, 8); 
  const end = new Date(currentYear, 11, 31); 
  let current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    const dateStr = formatDate(current);
    if (day !== 0 && day !== 6 && !TAIWAN_HOLIDAYS_2026.includes(dateStr)) {
      sessions.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }
  return sessions;
};

const parseCSV = (text) => {
  if (!text) return [];
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(line => line !== '');
  if (lines.length < 2) return [];
  return lines.slice(1).reduce((acc, line) => {
    const values = line.split(',').map(v => v.trim());
    if (values.length >= 2 && values[0] && values[1]) {
      acc.push({
        name: values[0],
        email: values[1],
        isMandatory: values[2] === '是' || values[2] === 'true' || values[2] === '1'
      });
    }
    return acc;
  }, []);
};

const App = () => {
  // 核心資料狀態
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('checkin'); 
  const [people, setPeople] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [sessionMetadata, setSessionMetadata] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [sheetUrl, setSheetUrl] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);
  
  // UI 互動狀態
  const [editingDate, setEditingDate] = useState(null); 
  const [tempEditValue, setTempEditValue] = useState('');
  const [pendingCancel, setPendingCancel] = useState(null); 
  const [viewingCheckinsDate, setViewingCheckinsDate] = useState(null); 
  const [viewingLeavesDate, setViewingLeavesDate] = useState(null); 
  
  // 自定義浮窗與提示
  const [toast, setToast] = useState(null); 
  const [confirmAction, setConfirmAction] = useState(null); 

  // --- 管理員驗證狀態 ---
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [targetAdminTab, setTargetAdminTab] = useState(null);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  // 簽到與抽籤狀態
  const [checkinEmail, setCheckinEmail] = useState('');
  const [identifiedPerson, setIdentifiedPerson] = useState(null);
  const [checkinStep, setCheckinStep] = useState('input'); 
  const [excludedIds, setExcludedIds] = useState([]);
  const [lotteryStartDate, setLotteryStartDate] = useState(getTodayStr());
  const [lotteryResults, setLotteryResults] = useState([]);

  // 表單狀態
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [isMandatory, setIsMandatory] = useState(true);
  
  const todayStr = useMemo(() => getTodayStr(), []);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const fileInputRef = useRef(null);
  const sessions = useMemo(() => getAllSessions(), []);

  // --- 初始化與資料同步 ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) { console.error("Auth Error:", error); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const peopleRef = collection(db, 'artifacts', appId, 'public', 'data', 'people');
    const checkinsRef = collection(db, 'artifacts', appId, 'public', 'data', 'checkins');
    const leavesRef = collection(db, 'artifacts', appId, 'public', 'data', 'leaves');
    const mRef = collection(db, 'artifacts', appId, 'public', 'data', 'sessionMetadata');

    const unsubP = onSnapshot(peopleRef, (s) => setPeople(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubC = onSnapshot(checkinsRef, (s) => setCheckins(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubL = onSnapshot(leavesRef, (s) => setLeaves(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubM = onSnapshot(mRef, (s) => {
      const meta = {};
      s.docs.forEach(d => { meta[d.id] = d.data(); });
      setSessionMetadata(meta);
      setLoading(false);
    });

    return () => { unsubP(); unsubC(); unsubL(); unsubM(); };
  }, [user]);

  // --- 提示系統 Helpers ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // --- 分頁導航權限驗證 ---
  const handleTabClick = (tabId) => {
    if (tabId === 'checkin') {
      setActiveTab(tabId);
    } else {
      if (isAuthenticatedAdmin) {
        setActiveTab(tabId);
      } else {
        setTargetAdminTab(tabId);
        setShowPasswordModal(true);
      }
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPasswordInput === '9032027') {
      setIsAuthenticatedAdmin(true);
      setActiveTab(targetAdminTab);
      setShowPasswordModal(false);
      setAdminPasswordInput('');
      showToast("管理員身分驗證成功！");
    } else {
      showToast("密碼錯誤，請重新輸入", "error");
      setAdminPasswordInput('');
    }
  };

  // --- 關鍵動作函式 ---
  const addPerson = async (e) => {
    e.preventDefault();
    if (!newName || !newEmail || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'people'), {
        name: newName, email: newEmail, isMandatory: isMandatory, createdAt: new Date().toISOString()
      });
      setNewName(''); setNewEmail('');
      showToast("已成功新增成員！");
    } catch (e) { console.error(e); showToast("新增失敗", "error"); }
  };

  const deletePerson = (id) => {
    if (!user) return;
    setConfirmAction({
      title: "刪除成員",
      message: "確定要刪除此成員嗎？這將無法復原。",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'people', id));
          showToast("已刪除成員");
        } catch (e) { console.error(e); showToast("刪除失敗", "error"); }
      }
    });
  };

  const toggleMandatory = async (id, currentStatus) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'people', id), { isMandatory: !currentStatus });
    } catch (e) { console.error(e); }
  };

  const handleSyncSheet = async () => {
    if (!sheetUrl || !user) return;
    setSyncLoading(true);
    try {
      const response = await fetch(sheetUrl);
      const text = await response.text();
      const parsedPeople = parseCSV(text);
      if (parsedPeople.length > 0) {
        const batch = writeBatch(db);
        parsedPeople.forEach(p => {
          const ref = doc(collection(db, 'artifacts', appId, 'public', 'data', 'people'));
          batch.set(ref, { name: p.name || "", email: p.email || "", isMandatory: !!p.isMandatory, createdAt: new Date().toISOString() });
        });
        await batch.commit();
        setSheetUrl('');
        showToast(`成功同步 ${parsedPeople.length} 位成員！`);
      } else {
        showToast("同步失敗，格式不正確", "error");
      }
    } catch (e) { console.error(e); showToast("同步失敗，請確認連結", "error"); }
    finally { setSyncLoading(false); }
  };

  const handleExportFullData = () => {
    const fullData = { version: "1.8", exportAt: new Date().toISOString(), people, checkins, leaves, sessionMetadata };
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AI早會全系統備份_${getTodayStr()}.json`;
    link.click();
    showToast("已匯出全系統備份 JSON");
  };

  const handleExportCSV = () => {
    let csvContent = "\uFEFF日期,場次名稱,分享者,實到人數,應到人數,請假人數,出席率(扣除請假),總出席率\n";
    sortedMonthKeys.forEach(month => {
      groupedStats[month].forEach(row => {
        csvContent += `${row.date},${row.sessionName || ""},${row.presenter || ""},${row.checkinCount},${row.mandatoryCount},${row.leaveCount},${row.rate}%,${row.grossRate}%\n`;
      });
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AI早會出席報表_${getTodayStr()}.csv`;
    link.click();
    showToast("已匯出出席報表 CSV");
  };

  const handleImportFullData = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.people) { showToast("不正確的備份格式", "error"); return; }
        
        setConfirmAction({
          title: "確認資料還原",
          message: "確定要執行還原嗎？這將會寫入與覆蓋資料庫中的紀錄。",
          onConfirm: async () => {
            setSyncLoading(true);
            try {
              const batch = writeBatch(db);
              data.people.forEach(p => {
                const ref = doc(db, 'artifacts', appId, 'public', 'data', 'people', p.id);
                batch.set(ref, { name: p.name, email: p.email, isMandatory: !!p.isMandatory, createdAt: p.createdAt || new Date().toISOString() });
              });
              if (data.checkins) {
                data.checkins.forEach(c => {
                  const ref = doc(db, 'artifacts', appId, 'public', 'data', 'checkins', c.id);
                  batch.set(ref, { personId: c.personId, date: c.date, timestamp: c.timestamp });
                });
              }
              if (data.leaves) {
                data.leaves.forEach(l => {
                  const ref = doc(db, 'artifacts', appId, 'public', 'data', 'leaves', l.id);
                  batch.set(ref, { personId: l.personId, date: l.date });
                });
              }
              if (data.sessionMetadata) {
                Object.entries(data.sessionMetadata).forEach(([date, meta]) => {
                  const ref = doc(db, 'artifacts', appId, 'public', 'data', 'sessionMetadata', date);
                  batch.set(ref, meta);
                });
              }
              await batch.commit();
              showToast("資料還原成功！");
            } catch (err) { console.error(err); showToast("還原失敗", "error"); }
            finally {
              setSyncLoading(false);
              if (fileInputRef.current) fileInputRef.current.value = null;
            }
          }
        });
      } catch (err) { 
        console.error(err); 
        showToast("檔案讀取失敗", "error"); 
        if (fileInputRef.current) fileInputRef.current.value = null;
      }
    };
    reader.readAsText(file);
  };

  // --- 抽籤系統 Actions ---
  const handleGenerateLottery = () => {
    const pool = people.filter(p => !excludedIds.includes(p.id));
    if (pool.length === 0) {
      showToast("沒有可抽籤的人員！請確認排除名單。", "error");
      return;
    }
    
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    // 取得未被刪除且大於等於開始日期的場次
    const upcomingSessions = sessions.filter(date => date >= lotteryStartDate && !sessionMetadata[date]?.isDeleted);
    const results = [];

    const drawCount = Math.min(shuffled.length, upcomingSessions.length);

    for (let i = 0; i < drawCount; i++) {
      results.push({ 
        date: upcomingSessions[i], 
        personName: shuffled[i].name || "未知成員" 
      });
    }
    
    setLotteryResults(results);
    showToast("已成功產生亂數配對！");
  };

  const executeConfirmLottery = async () => {
    setSyncLoading(true);
    try {
      for (const res of lotteryResults) {
        if (res.date && res.personName) {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'sessionMetadata', res.date);
          await setDoc(ref, { presenter: String(res.personName) }, { merge: true });
        }
      }
      
      showToast(`✅ 已成功將 ${lotteryResults.length} 位分享者寫入統計表！`);
      setLotteryResults([]);
      setActiveTab('dashboard'); 
    } catch (e) {
      console.error("Lottery Save Error:", e);
      showToast("寫入失敗，請檢查網路連線", "error");
    } finally {
      setSyncLoading(false);
    }
  };

  const confirmLotteryResults = () => {
    if (lotteryResults.length === 0 || !user) return;
    setConfirmAction({
      title: "加入統計確認",
      message: `確定要將這 ${lotteryResults.length} 位分享者分配寫入資料庫嗎？這將覆蓋該日期現有的分享者。`,
      onConfirm: executeConfirmLottery
    });
  };

  // --- 數據統計 Actions ---
  const saveMetadataField = async (date, field) => {
    if (!user) return;
    try {
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'sessionMetadata', date);
      await setDoc(ref, { [field]: tempEditValue }, { merge: true });
      setEditingDate(null);
      showToast("已儲存更新");
    } catch (e) { console.error(e); showToast("儲存失敗", "error"); }
  };

  const deleteSessionDate = (date) => {
    if (!user) return;
    setConfirmAction({
      title: "刪除場次",
      message: `確定要刪除 ${date} 的場次嗎？這將會從統計與抽籤列表中隱藏此日期。`,
      onConfirm: async () => {
        try {
          const ref = doc(db, 'artifacts', appId, 'public', 'data', 'sessionMetadata', date);
          await setDoc(ref, { isDeleted: true }, { merge: true });
          showToast(`已隱藏 ${date} 的場次`);
        } catch (e) { 
          console.error(e); 
          showToast("刪除場次失敗", "error"); 
        }
      }
    });
  };

  const toggleLeave = async (personId, date) => {
    if (!user) return;
    try {
      const exists = leaves.find(l => l.personId === personId && l.date === date);
      if (exists) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaves', exists.id));
      else await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'leaves'), { personId, date });
    } catch (e) { console.error(e); }
  };

  // --- 簽到 Actions ---
  const handleVerifyEmail = (e) => {
    e?.preventDefault();
    const inputPrefix = checkinEmail.trim().toLowerCase().split('@')[0];
    const person = people.find(p => (p.email || "").toLowerCase().split('@')[0] === inputPrefix);
    if (person) {
      setIdentifiedPerson(person);
      if (checkins.some(c => c.personId === person.id && c.date === todayStr)) setCheckinStep('success');
      else setCheckinStep('confirm');
    } else setCheckinStep('error');
  };

  const handleFinalCheckin = async () => {
    if (!identifiedPerson || !user) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'checkins'), {
        personId: identifiedPerson.id, date: todayStr, timestamp: new Date().toISOString()
      });
      setCheckinStep('success');
      showToast("簽到成功！");
    } catch (error) { console.error(error); showToast("簽到失敗", "error"); }
  };

  const resetCheckin = () => { setCheckinEmail(''); setIdentifiedPerson(null); setCheckinStep('input'); };

  const confirmCancelCheckin = async () => {
    if (!pendingCancel || !user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'checkins', pendingCancel.recordId));
      setPendingCancel(null); 
      resetCheckin();
      showToast("已成功撤回簽到紀錄");
    } catch (error) { console.error(error); showToast("撤回失敗", "error"); }
  };

  // --- 新增：手動刪除單筆簽到/請假紀錄 ---
  const deleteCheckinRecord = (recordId) => {
    if (!user) return;
    setConfirmAction({
      title: "刪除紀錄",
      message: "確定要刪除這筆簽到紀錄嗎？",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'checkins', recordId));
          showToast("已刪除該筆簽到紀錄");
        } catch (e) {
          console.error(e);
          showToast("刪除失敗", "error");
        }
      }
    });
  };

  const deleteLeaveRecord = (recordId) => {
    if (!user) return;
    setConfirmAction({
      title: "刪除紀錄",
      message: "確定要刪除這筆請假紀錄嗎？",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'leaves', recordId));
          showToast("已刪除該筆請假紀錄");
        } catch (e) {
          console.error(e);
          showToast("刪除失敗", "error");
        }
      }
    });
  };

  // --- 統計計算 ---
  const groupedStats = useMemo(() => {
    const mandatoryCount = people.filter(p => p.isMandatory).length;
    const groups = {};
    sessions.forEach(date => {
      const meta = sessionMetadata[date] || {};
      // 若該場次被標記為刪除，則直接跳過不顯示於統計表中
      if (meta.isDeleted) return;

      const month = getMonthName(date);
      if (!groups[month]) groups[month] = [];
      const dayCheckins = checkins.filter(c => c.date === date);
      const dayLeaves = leaves.filter(l => l.date === date);
      
      const mLeaves = dayLeaves.filter(l => people.find(p => p.id === l.personId)?.isMandatory).length;
      const target = Math.max(0, mandatoryCount - mLeaves);
      const rate = target > 0 ? (dayCheckins.length / target) * 100 : 0;
      const grossRate = mandatoryCount > 0 ? (dayCheckins.length / mandatoryCount) * 100 : 0;
      
      groups[month].push({ 
        date, 
        mandatoryCount, 
        checkinCount: dayCheckins.length, 
        leaveCount: dayLeaves.length, 
        rate: rate.toFixed(1), 
        grossRate: grossRate.toFixed(1),
        sessionName: meta.title || "", 
        presenter: meta.presenter || ""
      });
    });
    return groups;
  }, [people, checkins, leaves, sessions, sessionMetadata]);

  const sortedMonthKeys = useMemo(() => {
    return Object.keys(groupedStats).sort((a, b) => {
      const parse = (s) => {
        const match = s.match(/(\d+)年\s+(\d+)月/);
        return match ? parseInt(match[1]) * 12 + parseInt(match[2]) : 0;
      };
      return parse(a) - parse(b);
    });
  }, [groupedStats]);

  useEffect(() => {
    const currentMonth = getMonthName(todayStr);
    if (currentMonth && sortedMonthKeys.includes(currentMonth) && Object.keys(expandedMonths).length === 0) {
      setExpandedMonths({ [currentMonth]: true });
    }
  }, [todayStr, sortedMonthKeys]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-blue-600" size={32} /></div>;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative pb-24">
      
      {/* 頂部導覽 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg"><Clock size={24} /></div>
            <div><h1 className="text-xl font-bold tracking-tight text-slate-800">AI 早會系統</h1><p className="text-xs text-slate-400 font-medium">{todayStr}</p></div>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-2xl">
            {[
              { id: 'checkin', label: '簽到頁面', icon: UserCheck },
              { id: 'dashboard', label: '數據統計', icon: PieChart },
              { id: 'lottery', label: '人員抽籤', icon: Dices },
              { id: 'people', label: '人員管理', icon: Users }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => handleTabClick(tab.id)} 
                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${activeTab === tab.id ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
              >
                {activeTab === tab.id && tab.id !== 'checkin' && isAuthenticatedAdmin && <Lock size={12} className="opacity-50" />}
                <tab.icon size={16} /> {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* --- 簽到分頁 --- */}
        {activeTab === 'checkin' && (
          <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-10 text-white text-center">
                <Calendar className="mx-auto mb-4 opacity-90" size={56} />
                <h2 className="text-3xl font-black mb-1">{todayStr}</h2>
                <p className="text-blue-100 text-sm font-bold mb-4">{sessionMetadata[todayStr]?.title || "今日早會"}</p>
                {sessionMetadata[todayStr]?.presenter && <div className="inline-block bg-white/20 px-4 py-1.5 rounded-full text-sm font-black mb-2 shadow-sm">分享者：{sessionMetadata[todayStr].presenter}</div>}
              </div>
              <div className="p-8 min-h-[300px] flex flex-col justify-center">
                {checkinStep === 'input' && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const prefix = checkinEmail.trim().toLowerCase().split('@')[0];
                    const p = people.find(x => (x.email || "").toLowerCase().split('@')[0] === prefix);
                    if (p) {
                      setIdentifiedPerson(p);
                      if (checkins.some(c => c.personId === p.id && c.date === todayStr)) setCheckinStep('success');
                      else setCheckinStep('confirm');
                    } else setCheckinStep('error');
                  }} className="space-y-6">
                    <input type="text" required placeholder="Email 帳號 (免填 @...)" value={checkinEmail} onChange={e=>setCheckinEmail(e.target.value)} className="w-full px-6 py-5 rounded-3xl border-2 border-slate-50 outline-none focus:border-blue-200 focus:bg-white bg-slate-50/50 text-lg font-medium transition-all" />
                    <button type="submit" className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all">驗證身分</button>
                  </form>
                )}
                {checkinStep === 'confirm' && identifiedPerson && (
                  <div className="text-center animate-in zoom-in-95">
                    <h3 className="text-2xl font-black text-slate-800 mb-2">確認身分</h3>
                    <p className="text-2xl font-black text-blue-600 mb-8">{identifiedPerson.name}</p>
                    <button onClick={handleFinalCheckin} className="w-full bg-emerald-500 text-white py-5 rounded-3xl font-black shadow-xl hover:bg-emerald-600 active:scale-95 transition-all">這是我的姓名，確認簽到</button>
                    <button onClick={resetCheckin} className="mt-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">重新輸入</button>
                  </div>
                )}
                {checkinStep === 'success' && identifiedPerson && (
                  <div className="text-center">
                    <CheckCircle className="mx-auto text-emerald-500 mb-6" size={64} />
                    <h3 className="text-2xl font-black text-slate-800">簽到完成！</h3>
                    <div className="mt-8 flex flex-col gap-3">
                      <button onClick={resetCheckin} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black hover:bg-slate-800 transition-all">返回</button>
                      <button onClick={() => setPendingCancel({ person: identifiedPerson, recordId: checkins.find(c => c.personId === identifiedPerson.id && c.date === todayStr)?.id })} className="text-rose-400 text-sm font-bold flex items-center justify-center gap-1 hover:underline transition-all"><RotateCcw size={14} /> 撤銷紀錄</button>
                    </div>
                  </div>
                )}
                {checkinStep === 'error' && (
                  <div className="text-center animate-in zoom-in-95">
                    <AlertCircle className="mx-auto text-rose-500 mb-6" size={64} />
                    <h3 className="text-xl font-black text-slate-800 mb-2">找不到此帳號</h3>
                    <button onClick={resetCheckin} className="w-full mt-8 bg-slate-900 text-white py-5 rounded-3xl font-black hover:bg-slate-800 transition-all">重試一次</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- 數據統計分頁 --- */}
        {activeTab === 'dashboard' && isAuthenticatedAdmin && (
          <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
            <div className="flex justify-between items-end px-2">
              <div>
                <h2 className="text-2xl font-black text-slate-800">出席數據報表</h2>
                <p className="text-slate-400 text-sm">數據按月分組，點擊「場次名稱/分享者」可直接編輯</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleExportFullData} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all"><Database size={18} /> JSON 備份</button>
                <button onClick={handleExportCSV} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all"><FileSpreadsheet size={18} /> 匯出報表 (CSV)</button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">今日實到</div>
                <div className="text-3xl font-black text-slate-800">{checkins.filter(c => c.date === todayStr).length} <span className="text-xs font-normal text-slate-300">人</span></div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">今日請假</div>
                <div className="text-3xl font-black text-rose-500">{leaves.filter(l => l.date === todayStr).length} <span className="text-xs font-normal text-slate-300">人</span></div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">應到基準</div>
                <div className="text-3xl font-black text-blue-600">{people.filter(p => p.isMandatory).length} <span className="text-xs font-normal text-slate-300">人</span></div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-slate-400 text-[10px] font-bold uppercase mb-1">今日出席率</div>
                <div className="text-3xl font-black text-emerald-500">{groupedStats[getMonthName(todayStr)]?.find(d => d.date === todayStr)?.rate || '0.0'}%</div>
              </div>
            </div>

            <div className="space-y-4">
              {sortedMonthKeys.map(month => (
                <div key={month} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                  <button onClick={() => setExpandedMonths(p => ({...p, [month]: !p[month]}))} className="w-full p-6 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors border-b border-slate-50">
                    <div className="flex items-center gap-4"><div className="p-2 bg-blue-50 rounded-xl text-blue-600"><PieChart size={20} /></div><h3 className="font-black text-xl">{month}</h3></div>
                    {expandedMonths[month] ? <ChevronUp className="text-slate-300" /> : <ChevronDown className="text-slate-300" />}
                  </button>
                  {expandedMonths[month] && (
                    <div className="overflow-x-auto px-4 pb-4">
                      <table className="w-full text-left text-sm min-w-[1000px]">
                        <thead>
                          <tr className="text-slate-400 text-[10px] font-black uppercase border-b border-slate-50">
                            <th className="px-4 py-4">日期</th>
                            <th className="px-4 py-4">場次名稱</th>
                            <th className="px-4 py-4">分享者</th>
                            <th className="px-4 py-4 text-center">實到 / 應到</th>
                            <th className="px-4 py-4 text-center">請假人數</th>
                            <th className="px-4 py-4 text-center">出席率</th>
                            <th className="px-4 py-4 text-center">總出席率</th>
                            <th className="px-4 py-4 text-right">管理</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {groupedStats[month].map(s => (
                            <tr key={s.date} className={s.date === todayStr ? "bg-blue-50/40" : "hover:bg-slate-50 transition-colors"}>
                              <td className="px-4 py-4 font-bold text-slate-700">{s.date}</td>
                              <td className="px-4 py-4">
                                {editingDate?.date === s.date && editingDate?.field === 'title' ? (
                                  <div className="flex items-center gap-2"><input autoFocus value={tempEditValue} onChange={e=>setTempEditValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveMetadataField(s.date, 'title')} className="border border-blue-200 rounded-lg px-2 py-1 text-sm outline-none w-full shadow-inner" /><button onClick={()=>saveMetadataField(s.date, 'title')} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded"><Check size={16}/></button></div>
                                ) : (
                                  <div className="flex items-center gap-2 group min-h-[32px] cursor-pointer" onClick={()=>{setEditingDate({date: s.date, field: 'title'}); setTempEditValue(s.sessionName);}}>
                                    <span className={s.sessionName ? "text-slate-700 font-bold" : "text-slate-300 italic text-xs"}>{s.sessionName || "點擊編輯"}</span>
                                    <Edit3 size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                {editingDate?.date === s.date && editingDate?.field === 'presenter' ? (
                                  <div className="flex items-center gap-2"><input autoFocus value={tempEditValue} onChange={e=>setTempEditValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&saveMetadataField(s.date, 'presenter')} className="border border-blue-200 rounded-lg px-2 py-1 text-sm outline-none w-full shadow-inner" /><button onClick={()=>saveMetadataField(s.date, 'presenter')} className="text-emerald-500 hover:bg-emerald-50 p-1 rounded"><Check size={16}/></button></div>
                                ) : (
                                  <div className="flex items-center gap-2 group min-h-[32px] cursor-pointer" onClick={()=>{setEditingDate({date: s.date, field: 'presenter'}); setTempEditValue(s.presenter);}}>
                                    <span className={s.presenter ? "text-blue-600 font-black" : "text-slate-300 italic text-xs"}>{s.presenter || "點擊編輯"}</span>
                                    <Edit3 size={12} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-4 text-center">
                                <button onClick={()=>setViewingCheckinsDate(s.date)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl text-xs font-black mx-auto flex items-center gap-1 hover:bg-blue-600 hover:text-white transition-all shadow-sm"><UserCheck size={12}/> {s.checkinCount} / {s.mandatoryCount}</button>
                              </td>
                              <td className="px-4 py-4 text-center">
                                <button onClick={()=>setViewingLeavesDate(s.date)} className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all mx-auto flex items-center gap-1 shadow-sm ${s.leaveCount > 0 ? 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white' : 'bg-slate-50 text-slate-400 cursor-default'}`}>
                                  <UserMinus size={12} /> {s.leaveCount}
                                </button>
                              </td>
                              <td className="px-4 py-4 text-center font-black text-emerald-600">{s.rate}%</td>
                              <td className="px-4 py-4 text-center font-black text-slate-400">{s.grossRate}%</td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <button onClick={()=>{setSelectedDate(s.date);setActiveTab('leaves');}} className="text-blue-600 font-black text-xs hover:underline">管理請假</button>
                                  <button onClick={()=>deleteSessionDate(s.date)} className="text-slate-300 hover:text-rose-500 transition-colors" title="刪除此場次">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 人員抽籤分頁 --- */}
        {activeTab === 'lottery' && isAuthenticatedAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-2"><Dices className="text-blue-600" /> 抽籤設定</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">開始日期</label>
                    <input type="date" value={lotteryStartDate} onChange={(e) => setLotteryStartDate(e.target.value)} className="w-full px-5 py-3 rounded-2xl border border-slate-100 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">排除人員 ({excludedIds.length})</label>
                    <div className="max-h-[300px] overflow-y-auto border border-slate-50 rounded-2xl p-2 space-y-1 custom-scrollbar">
                      {people.map(p => (
                        <label key={p.id} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${excludedIds.includes(p.id) ? 'bg-rose-50 text-rose-600' : 'hover:bg-slate-50'}`}>
                          <span className="font-bold">{p.name}</span>
                          <input type="checkbox" className="hidden" checked={excludedIds.includes(p.id)} onChange={(e) => {
                            if (e.target.checked) setExcludedIds([...excludedIds, p.id]);
                            else setExcludedIds(excludedIds.filter(id => id !== p.id));
                          }} />
                          {excludedIds.includes(p.id) ? <UserX size={16} /> : <div className="w-4 h-4 border-2 border-slate-200 rounded" />}
                        </label>
                      ))}
                    </div>
                  </div>
                  <button onClick={handleGenerateLottery} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95"><RefreshCw size={18} /> 開始亂數配對 (只抽一輪)</button>
                </div>
              </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm min-h-[500px]">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="font-black text-xl text-slate-800">分配預覽</h3>
                  {lotteryResults.length > 0 && (
                    <button onClick={confirmLotteryResults} disabled={syncLoading} className="bg-emerald-500 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all active:scale-95">
                      {syncLoading ? <RefreshCw className="animate-spin" /> : <Save size={18} />} 確定加入統計
                    </button>
                  )}
                </div>
                {lotteryResults.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in zoom-in-95">
                    {lotteryResults.map((res, i) => (
                      <div key={i} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-slate-400 mr-3 shadow-sm">{i+1}</div>
                        <div className="flex-1"><p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">{res.date}</p><p className="text-lg font-black text-slate-800">{res.personName}</p></div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center py-20 text-slate-300"><Dices size={64} className="mx-auto mb-4 opacity-20" /><p className="italic font-bold">請先於左側設定並點擊「開始亂數配對」</p></div>}
              </div>
            </div>
          </div>
        )}

        {/* --- 人員管理 --- */}
        {activeTab === 'people' && isAuthenticatedAdmin && (
          <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-8 rounded-[2.5rem] text-white shadow-xl">
                <div className="flex items-center gap-3 mb-6"><LinkIcon size={28} /><h3 className="text-xl font-black">試算表同步 (CSV)</h3></div>
                <div className="flex gap-4">
                  <input type="text" placeholder="貼上 CSV 連結..." value={sheetUrl} onChange={e=>setSheetUrl(e.target.value)} className="flex-1 bg-white/20 border border-white/30 rounded-2xl px-6 py-3 outline-none" />
                  <button onClick={handleSyncSheet} disabled={syncLoading || !sheetUrl} className="bg-white text-emerald-600 px-8 py-3 rounded-2xl font-black shadow-lg hover:bg-emerald-50 transition-all">同步</button>
                </div>
              </div>
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl">
                <div className="flex items-center gap-3 mb-6"><Upload size={28} /><h3 className="text-xl font-black">資料還原 (JSON)</h3></div>
                <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportFullData} className="hidden" />
                <button onClick={() => fileInputRef.current.click()} disabled={syncLoading} className="w-full bg-white text-blue-600 py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-blue-50 transition-all shadow-lg">{syncLoading ? <RefreshCw className="animate-spin" /> : <><FileJson size={20} /> 選擇檔案並還原</>}</button>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm sticky top-24">
                  <h3 className="font-black mb-6 flex items-center gap-2 text-blue-600 uppercase tracking-tight"><UserPlus size={20} /> 手動新增成員</h3>
                  <form onSubmit={addPerson} className="space-y-5">
                    <input placeholder="姓名" required value={newName} onChange={e=>setNewName(e.target.value)} className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                    <input placeholder="Email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-5 py-3 rounded-2xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 transition-all" />
                    <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={isMandatory} onChange={e=>setIsMandatory(e.target.checked)} className="w-4 h-4 rounded text-blue-600" /><span className="text-sm font-black text-slate-600">必參加成員</span></label>
                    <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 active:scale-95 transition-all">加入名單</button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-2 bg-white rounded-[2rem] shadow-sm overflow-hidden border border-slate-50">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                    <tr><th className="px-6 py-4">姓名 / Email</th><th className="px-6 py-4 text-center">必參加</th><th className="px-6 py-4 text-right">管理</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {people.sort((a,b)=>a.name.localeCompare(b.name)).map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                        <td className="px-6 py-5"><div className="font-black text-slate-800">{p.name}</div><div className="text-xs text-slate-400">{p.email}</div></td>
                        <td className="px-6 py-5 text-center"><button onClick={()=>toggleMandatory(p.id, p.isMandatory)} className={`p-2 rounded-xl transition-all ${p.isMandatory ? 'text-blue-600 bg-blue-50 shadow-sm' : 'text-slate-200 hover:text-blue-300'}`}><CheckCircle size={20} fill={p.isMandatory?"currentColor":"none"}/></button></td>
                        <td className="px-6 py-5 text-right"><button onClick={()=>deletePerson(p.id)} className="text-slate-200 hover:text-rose-500 transition-colors p-2"><Trash2 size={18} /></button></td>
                      </tr>
                    ))}
                    {people.length === 0 && <tr><td colSpan="3" className="p-10 text-center text-slate-300 italic font-bold">目前無人員資料</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* --- 請假管理分頁 --- */}
        {activeTab === 'leaves' && isAuthenticatedAdmin && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
             <div className="flex items-center justify-between"><h3 className="text-2xl font-black flex items-center gap-3 text-rose-500"><Calendar /> 請假管理 ({selectedDate})</h3></div>
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
              <div className="grid grid-cols-2 gap-4">
                {people.map(p => {
                  const l = leaves.some(i => i.personId === p.id && i.date === selectedDate);
                  return (
                    <button key={p.id} onClick={() => toggleLeave(p.id, selectedDate)} className={`flex items-center justify-between p-5 rounded-[1.5rem] border-2 transition-all active:scale-95 ${l ? 'bg-rose-50 border-rose-100 text-rose-700 shadow-inner' : 'bg-white border-slate-50 hover:border-rose-100 text-slate-600'}`}>
                      <span className="font-black">{p.name}</span>{l ? <XCircle size={20} className="text-rose-500" /> : <div className="w-5 h-5 border-2 border-slate-200 rounded-full" />}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setActiveTab('dashboard')} className="w-full mt-12 bg-slate-900 text-white py-5 rounded-3xl font-black shadow-xl active:scale-95 transition-all">保存並返回數據統計</button>
            </div>
          </div>
        )}

        {/* --- 彈出詳情視窗 (簽到) --- */}
        {viewingCheckinsDate && (
          <div className="fixed inset-0 z-40 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3"><UserCheck size={24} /><div><h3 className="font-black text-lg text-white">簽到人員名單</h3><p className="text-xs opacity-80 uppercase font-bold text-white/80">{viewingCheckinsDate}</p></div></div>
                <button onClick={() => setViewingCheckinsDate(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"><X size={20}/></button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                  {checkins.filter(c => c.date === viewingCheckinsDate).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).map((c, i) => {
                    const p = people.find(x => x.id === c.personId);
                    return (
                      <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                        <span className="font-black text-slate-800 flex items-center gap-3"><span className="text-[10px] text-slate-300 w-4">{i+1}</span>{p?.name || "未知人員"}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-blue-600 font-mono font-black">{formatTime(c.timestamp)}</span>
                          <button onClick={() => deleteCheckinRecord(c.id)} className="text-slate-300 hover:text-rose-500 transition-colors" title="刪除此紀錄">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {checkins.filter(c => c.date === viewingCheckinsDate).length === 0 && <div className="text-center py-10 text-slate-400 italic font-bold">目前無簽到紀錄</div>}
                </div>
              </div>
              <div className="p-6 border-t border-slate-50"><button onClick={()=>setViewingCheckinsDate(null)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all shadow-md">關閉詳情</button></div>
            </div>
          </div>
        )}

        {/* --- 彈出詳情視窗 (請假) --- */}
        {viewingLeavesDate && (
          <div className="fixed inset-0 z-40 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="bg-rose-600 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3"><UserMinus size={24} /><div><h3 className="font-black text-lg text-white">請假名單</h3><p className="text-xs opacity-80 uppercase font-bold text-white/80">{viewingLeavesDate}</p></div></div>
                <button onClick={() => setViewingLeavesDate(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"><X size={20}/></button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="space-y-3">
                  {leaves.filter(l => l.date === viewingLeavesDate).map((l, i) => {
                    const p = people.find(x => x.id === l.personId);
                    return (
                      <div key={l.id} className="flex items-center justify-between p-4 bg-rose-50/30 rounded-2xl border border-rose-100/50 shadow-sm">
                        <span className="font-black text-slate-800 flex items-center gap-3"><span className="text-[10px] text-rose-200 w-4">{i+1}</span>{p?.name || "未知人員"}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-black uppercase">標記請假</span>
                          <button onClick={() => deleteLeaveRecord(l.id)} className="text-rose-300 hover:text-rose-600 transition-colors" title="刪除此紀錄">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {leaves.filter(l => l.date === viewingLeavesDate).length === 0 && <div className="text-center py-10 text-slate-400 italic font-bold">目前無請假紀錄</div>}
                </div>
              </div>
              <div className="p-6 border-t border-slate-50"><button onClick={()=>setViewingLeavesDate(null)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-rose-800 transition-all shadow-md">關閉詳情</button></div>
            </div>
          </div>
        )}

        {/* --- 通用：確認浮窗 --- */}
        {confirmAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in-95 text-center">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-500 mx-auto mb-6"><AlertCircle size={48} /></div>
              <h3 className="text-xl font-black mb-2 text-slate-800 tracking-tight">{confirmAction.title}</h3>
              <p className="text-slate-500 text-sm mb-8 font-medium leading-relaxed">{confirmAction.message}</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all">確定</button>
                <button onClick={() => setConfirmAction(null)} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black hover:bg-slate-200 transition-all">取消</button>
              </div>
            </div>
          </div>
        )}

        {/* --- 管理員密碼驗證浮窗 --- */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 text-center animate-in zoom-in-95">
              <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-500 mx-auto mb-6">
                <Lock size={48} />
              </div>
              <h3 className="text-xl font-black mb-2 text-slate-800 tracking-tight">管理員權限驗證</h3>
              <p className="text-slate-500 text-sm mb-6 font-medium">請輸入密碼以進入管理頁面</p>
              <form onSubmit={handleAdminLogin} className="flex flex-col gap-3">
                <input 
                  type="password" 
                  autoFocus
                  placeholder="輸入密碼..." 
                  value={adminPasswordInput} 
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-100 bg-slate-50 outline-none focus:border-blue-200 transition-all font-bold text-center tracking-widest text-lg"
                />
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all mt-2">驗證並進入</button>
                <button type="button" onClick={() => { setShowPasswordModal(false); setAdminPasswordInput(''); setTargetAdminTab(null); }} className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black hover:bg-slate-200 transition-all">取消</button>
              </form>
            </div>
          </div>
        )}

        {/* --- 通用：提示條 (Toast) --- */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className={`px-6 py-4 rounded-full shadow-2xl font-bold flex items-center gap-3 ${toast.type === 'error' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'}`}>
              {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
              {toast.message}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;