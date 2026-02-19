import * as React from 'react';
import styles from '../../Clients/RightPanelTabs/TasksTab.module.scss';
import type { EntitySelection } from '../../Clients/RightPanelTabs/EntitiesTab';

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const ENTITY_TERM_SET_ID = '63f8136b-40cf-4d43-890a-73d4959c5a68';
const ENTITY_TASK_NEW_FORM_URL =
  'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7B6CD2A192-B82C-4304-A936-F400D0E66FEC%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FTasks&Source=https%3A%2F%2Frealitycraftprivatelimited.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FTasks%2FAllItems.aspx&ContentTypeId=0x0100A2DB78381F4D3541900EBE1DE131DD3E0064E6958DA895BF44AC2862F2A62CFE11';

interface EntityTasksTabProps {
  webUrl: string;
  entity: EntitySelection | null;
}

type PriorityFilter = 'ALL' | 'HIGH' | 'NORMAL' | 'LOW' | 'ON HOLD';

const EntityTasksTab: React.FC<EntityTasksTabProps> = ({ webUrl, entity }) => {
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entityTerms, setEntityTerms] = React.useState<Record<string, string>>({});
  const [searchText, setSearchText] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>('ALL');
  const [showAddPopup, setShowAddPopup] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: 'Title' | 'Entity' | 'AssignedTo' | 'DueDate1' | 'Priority' | 'Status'; direction: 'asc' | 'desc' }>({
    key: 'Title',
    direction: 'asc'
  });

  const parseTaxonomyLabel = (value?: any): string => {
    if (!value) return '—';

    if (typeof value === 'string') {
      const labels = value
        .split(';#')
        .filter(v => v.includes('|'))
        .map(v => v.split('|')[0])
        .filter(Boolean);
      return labels.join(', ') || value;
    }

    if (Array.isArray(value)) {
      const labels = value
        .map(v => v?.Label || v?.label || v?.Title || v?.TermGuid)
        .filter(Boolean);
      return labels.join(', ') || '—';
    }

    if (typeof value === 'object') {
      return value.Label || value.label || value.Title || value.TermGuid || '—';
    }

    return String(value);
  };

  const collectTermGuids = (value: any, set: Set<string>): void => {
    if (!value) return;

    if (typeof value === 'string') {
      value
        .split(';#')
        .filter(v => v.includes('|'))
        .forEach(v => {
          const guid = v.split('|')[1];
          if (guid) set.add(guid.toLowerCase());
        });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(v => collectTermGuids(v, set));
      return;
    }

    if (typeof value === 'object' && value.TermGuid) {
      set.add(String(value.TermGuid).toLowerCase());
    }
  };

  const renderEntity = (task: any): string => {
    const raw = task.RelatedEntity || task.ReletedEntity;
    const guids = new Set<string>();
    collectTermGuids(raw, guids);

    if (!guids.size) {
      return parseTaxonomyLabel(raw);
    }

    return Array.from(guids)
      .map(g => entityTerms[g] || g)
      .join(', ');
  };

  const renderAssignedTo = (value: any): string => {
    if (!value) return '—';
    if (Array.isArray(value)) {
      return value
        .map(v => v?.Title || v?.name || v?.EMail || v?.Email)
        .filter(Boolean)
        .join(', ') || '—';
    }
    if (typeof value === 'object') {
      return value.Title || value.name || value.EMail || value.Email || '—';
    }
    return '—';
  };

  const normalizePriority = (value: any): string => {
    const text = String(value || '').toLowerCase();
    if (text.includes('high')) return 'HIGH';
    if (text.includes('normal')) return 'NORMAL';
    if (text.includes('low')) return 'LOW';
    if (text.includes('on hold')) return 'ON HOLD';
    return '';
  };

  const matchesPriorityFilter = (value: any): boolean => {
    if (priorityFilter === 'ALL') return true;
    return normalizePriority(value) === priorityFilter;
  };

  const formatDate = (value: any): string => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPriorityClass = (value: any): string => {
    const p = normalizePriority(value);
    if (p === 'HIGH') return styles.priorityHigh;
    if (p === 'NORMAL') return styles.priorityNormal;
    if (p === 'LOW') return styles.priorityLow;
    if (p === 'ON HOLD') return styles.priorityOnHold;
    return '';
  };

  const getStatusClass = (value: any): string => {
    const text = String(value || '').toLowerCase();
    if (text.includes('progress')) return styles.statusInProgress;
    if (text.includes('to do')) return styles.statusTodo;
    if (text.includes('complete')) return styles.statusComplete;
    return styles.statusDefault;
  };

  const loadEntityTerms = async (fetchJson: (url: string) => Promise<any>, taskItems: any[]): Promise<void> => {
    const entityGuids = new Set<string>();
    taskItems.forEach(task => collectTermGuids(task.RelatedEntity || task.ReletedEntity, entityGuids));

    if (!entityGuids.size) {
      setEntityTerms({});
      return;
    }

    const termData = await fetchJson(
      `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${ENTITY_TERM_SET_ID}')/terms`
    );

    const map: Record<string, string> = {};
    (termData.value || []).forEach((term: any) => {
      const id = String(term.id || '').toLowerCase();
      if (!id || !entityGuids.has(id)) return;

      const label =
        term.labels?.find((l: any) => l.isDefault)?.name ||
        term.labels?.[0]?.name;
      if (label) {
        map[id] = label;
      }
    });

    setEntityTerms(map);
  };

  const loadTasks = async () => {
    if (!entity?.termGuid) {
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const fetchJson = async (url: string) => {
        const resp = await fetch(url, {
          headers: { Accept: 'application/json;odata=nometadata' }
        });

        if (!resp.ok) {
          const detail = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${detail || 'Request failed'}`);
        }

        return resp.json();
      };

      const taskData = await fetchJson(
        `${webUrl}/_api/web/lists/getByTitle('Tasks')/items?` +
          `$select=Id,Title,Status,Priority,DueDate1,RelatedClient,RelatedEntity,AssignedTo1/Title,AssignedTo1/EMail&` +
          `$expand=AssignedTo1&` +
          `$top=5000`,
      );
      const allTasks = taskData.value || [];

      const filtered = allTasks.filter((task: any) => {
        const guids = new Set<string>();
        collectTermGuids(task.RelatedEntity || task.ReletedEntity, guids);
        return guids.has(entity.termGuid.toLowerCase());
      });

      await loadEntityTerms(fetchJson, filtered);
      setTasks(filtered);
    } catch (err) {
      console.error('Entity tasks load error', err);
      setError(err instanceof Error ? `Failed to load tasks: ${err.message}` : 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadTasks();
  }, [entity?.termGuid, webUrl]);

  const openAddTask = () => {
    setShowAddPopup(true);
  };

  const closeAddTask = () => {
    setShowAddPopup(false);
    void loadTasks();
  };

  // NEW: Fast-close logic for the Task iframe
  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    try {
      const iframe = e.target as HTMLIFrameElement;
      const iframeWindow = iframe.contentWindow;
      const iframeUrl = iframeWindow?.location.href;
      
      if (iframeUrl) {
        const urlObj = new URL(iframeUrl);
        
        // 1. FALLBACK: Close if it manages to load AllItems.aspx
        if (urlObj.pathname.toLowerCase().endsWith('allitems.aspx')) {
          closeAddTask();
          return;
        }

        // 2. FAST CLOSE: Catch the unload event the moment Save/Cancel is clicked
        if (iframeWindow) {
          iframeWindow.addEventListener('unload', () => {
            setTimeout(() => {
              closeAddTask();
            }, 100);
          });
        }
      }
    } catch (error) {
      console.warn("Iframe load check:", error);
    }
  };

  const filteredTasks = React.useMemo(() => {
    const search = searchText.trim().toLowerCase();

    return tasks.filter(task => {
      if (!matchesPriorityFilter(task.Priority)) {
        return false;
      }

      if (!search) {
        return true;
      }

      const fields = [
        String(task.Title || ''),
        String(renderEntity(task) || ''),
        String(renderAssignedTo(task.AssignedTo1) || ''),
        String(task.DueDate1 || ''),
        String(task.Priority || ''),
        String(task.Status || '')
      ]
        .join(' ')
        .toLowerCase();

      return fields.includes(search);
    });
  }, [tasks, searchText, priorityFilter, entityTerms]);

  const sortedTasks = React.useMemo(() => {
    const list = [...filteredTasks];
    const compare = (a: any, b: any): number => {
      const { key, direction } = sortConfig;
      const dir = direction === 'asc' ? 1 : -1;

      if (key === 'Entity') {
        const av = renderEntity(a).toLowerCase();
        const bv = renderEntity(b).toLowerCase();
        return av.localeCompare(bv) * dir;
      }

      if (key === 'AssignedTo') {
        const av = renderAssignedTo(a.AssignedTo1).toLowerCase();
        const bv = renderAssignedTo(b.AssignedTo1).toLowerCase();
        return av.localeCompare(bv) * dir;
      }

      if (key === 'DueDate1') {
        const av = new Date(a.DueDate1 || '').getTime();
        const bv = new Date(b.DueDate1 || '').getTime();
        return (av - bv) * dir;
      }

      const av = String(a[key] || '').toLowerCase();
      const bv = String(b[key] || '').toLowerCase();
      return av.localeCompare(bv) * dir;
    };

    return list.sort(compare);
  }, [filteredTasks, sortConfig, entityTerms]);

  const handleSort = (key: typeof sortConfig.key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  if (loading) {
    return <div className={styles.loading}>Loading tasks…</div>;
  }

  if (error) {
    return <div className={styles.noData}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <input
          type="text"
          className={styles.searchBox}
          placeholder="Search Tasks"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
        />
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => {
            setSearchText('');
            setPriorityFilter('ALL');
          }}
        >
          Clear Search
        </button>
        <div/>
        <button type="button" className={styles.addBtn} onClick={openAddTask}>
          + Add Task
        </button>
      </div>

      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterBtn} ${priorityFilter === 'ALL' ? styles.active : ''}`}
          onClick={() => setPriorityFilter('ALL')}
        >
          All Tasks
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${priorityFilter === 'HIGH' ? styles.active : ''}`}
          onClick={() => setPriorityFilter('HIGH')}
        >
          High
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${priorityFilter === 'NORMAL' ? styles.active : ''}`}
          onClick={() => setPriorityFilter('NORMAL')}
        >
          Normal
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${priorityFilter === 'LOW' ? styles.active : ''}`}
          onClick={() => setPriorityFilter('LOW')}
        >
          Low
        </button>
        <button
          type="button"
          className={`${styles.filterBtn} ${priorityFilter === 'ON HOLD' ? styles.active : ''}`}
          onClick={() => setPriorityFilter('ON HOLD')}
        >
          On Hold
        </button>
      </div>

      <div className={styles.tableContainer}>
        <div className={styles.table}>
          <div className={styles.headerRow}>
            <button
              type="button"
              className={`${styles.headerCell} ${styles.sortable} ${
                sortConfig.key === 'Title' ? styles[`sort${sortConfig.direction}`] : ''
              }`}
              onClick={() => handleSort('Title')}
            >
              <span>Task Name</span>
            </button>
            <button
              type="button"
              className={`${styles.headerCell} ${styles.sortable} ${
                sortConfig.key === 'Entity' ? styles[`sort${sortConfig.direction}`] : ''
              }`}
              onClick={() => handleSort('Entity')}
            >
              <span>Entity</span>
            </button>
            <button
              type="button"
              className={`${styles.headerCell} ${styles.sortable} ${
                sortConfig.key === 'AssignedTo' ? styles[`sort${sortConfig.direction}`] : ''
              }`}
              onClick={() => handleSort('AssignedTo')}
            >
              <span>Assigned To</span>
            </button>
            <button
              type="button"
              className={`${styles.headerCell} ${styles.sortable} ${
                sortConfig.key === 'DueDate1' ? styles[`sort${sortConfig.direction}`] : ''
              }`}
              onClick={() => handleSort('DueDate1')}
            >
              <span>Due Date</span>
            </button>
            <button
              type="button"
              className={`${styles.headerCell} ${styles.sortable} ${
                sortConfig.key === 'Priority' ? styles[`sort${sortConfig.direction}`] : ''
              }`}
              onClick={() => handleSort('Priority')}
            >
              <span>Priority</span>
            </button>
            <button
              type="button"
              className={`${styles.headerCell} ${styles.sortable} ${
                sortConfig.key === 'Status' ? styles[`sort${sortConfig.direction}`] : ''
              }`}
              onClick={() => handleSort('Status')}
            >
              <span>Status</span>
            </button>
          </div>

          <div className={styles.bodyRows}>
            {!sortedTasks.length && (
              <div className={styles.noData}>No tasks found</div>
            )}

            {sortedTasks.map(t => (
              <div key={t.Id} className={styles.dataRow}>
                <div className={styles.link}>{t.Title}</div>
                <div>{renderEntity(t)}</div>
                <div>{renderAssignedTo(t.AssignedTo1)}</div>
                <div>{formatDate(t.DueDate1)}</div>
                <div className={getPriorityClass(t.Priority)}>{t.Priority || '—'}</div>
                <div className={getStatusClass(t.Status)}>{t.Status || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddPopup && (
        <div className={styles.popupOverlay} role="dialog" aria-modal="true" aria-label="Add new task">
          <div className={styles.popupCard}>
            <div className={styles.popupHeader}>
              <span>Add New Task</span>
              <button
                type="button"
                className={styles.popupClose}
                aria-label="Close add task form"
                onClick={closeAddTask}
              >
                ×
              </button>
            </div>
            <iframe 
              title="Add New Task" 
              src={ENTITY_TASK_NEW_FORM_URL} 
              className={styles.popupFrame}
              onLoad={handleIframeLoad} // NEW: Added onLoad listener here
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityTasksTab;