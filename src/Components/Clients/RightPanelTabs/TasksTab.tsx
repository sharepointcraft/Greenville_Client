import * as React from 'react';
import styles from './TasksTab.module.scss';
import {
  TENANT_CONFIG,
  buildListItemsApiUrl,
  fetchTermLabelMap,
  type PriorityFilter
} from '../../../config/tenantConfig';

interface TasksTabProps {
  webUrl: string;
  clientId: number;
  clientTermGuid: string;
}

const TasksTab: React.FC<TasksTabProps> = ({
  webUrl,
  clientId,
  clientTermGuid
}) => {
  type TaskSortKey = 'Title' | 'Entity' | 'AssignedTo' | 'DueDate' | 'Priority' | 'Status';
  const taskFormPathRef = React.useRef<string>('');

  const [tasks, setTasks] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [entityTerms, setEntityTerms] = React.useState<Record<string, string>>({});
  const [searchText, setSearchText] = React.useState('');
  const [priorityFilter, setPriorityFilter] = React.useState<PriorityFilter>(
    TENANT_CONFIG.ui.tasks.priorityFilters[0]
  );
  const [showAddPopup, setShowAddPopup] = React.useState(false);
  const [sortConfig, setSortConfig] = React.useState<{ key: TaskSortKey; direction: 'asc' | 'desc' }>({
    key: 'Title',
    direction: 'asc'
  });

  /* ---------------- HELPERS ---------------- */

  const parseTaxonomyLabel = (value?: any): string => {
    if (!value) return '—';

    if (typeof value === 'string') {
      const labels = value
        .split(';#')
        .filter(v => v.includes('|'))
        .map(v => v.split('|')[0])
        .filter(Boolean);
      if (labels.length) {
        return labels.join(', ');
      }

      const raw = value.trim();
      if (!raw) return '—';
      if (TENANT_CONFIG.patterns.guidExact.test(raw)) return '—';

      const guidMatches = raw.match(TENANT_CONFIG.patterns.guid) || [];
      if (guidMatches.length) {
        const leftover = raw
          .replace(TENANT_CONFIG.patterns.guid, '')
          .replace(/[|;,#]/g, '')
          .trim();
        if (!leftover) {
          return '—';
        }
      }

      return raw;
    }

    if (Array.isArray(value)) {
      const labels = value
        .map(v => v?.Label || v?.label || v?.Title || v?.TermGuid)
        .filter((v: any) => Boolean(v) && !TENANT_CONFIG.patterns.guidExact.test(String(v).trim()));
      return labels.join(', ') || '—';
    }

    if (typeof value === 'object') {
      const label = value.Label || value.label || value.Title || value.title || value.name;
      if (label && !TENANT_CONFIG.patterns.guidExact.test(String(label).trim())) {
        return String(label);
      }
      return '—';
    }

    return String(value);
  };

  const collectTermGuids = (value: any, set: Set<string>): void => {
    if (!value) return;

    if (typeof value === 'string') {
      const matches = value.match(TENANT_CONFIG.patterns.guid);
      (matches || []).forEach(guid => set.add(guid.toLowerCase()));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(v => collectTermGuids(v, set));
      return;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value.results)) {
        value.results.forEach((entry: any) => collectTermGuids(entry, set));
      }

      const guid = value.TermGuid || value.termGuid || value.Id || value.id;
      if (guid && typeof guid === 'string') {
        const matches = guid.match(TENANT_CONFIG.patterns.guid);
        (matches || []).forEach(matchedGuid => set.add(matchedGuid.toLowerCase()));
      }
    }
  };

  const collectInlineTermLabels = (value: any, map: Record<string, string>): void => {
    if (!value) return;

    if (typeof value === 'string') {
      value
        .split(';#')
        .filter(v => v.includes('|'))
        .forEach(v => {
          const parts = v.split('|');
          const label = (parts[0] || '').trim();
          const guidMatches = (parts[1] || '').match(TENANT_CONFIG.patterns.guid);
          (guidMatches || []).forEach(guid => {
            if (label && !TENANT_CONFIG.patterns.guidExact.test(label)) {
              map[guid.toLowerCase()] = label;
            }
          });
        });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(v => collectInlineTermLabels(v, map));
      return;
    }

    if (typeof value === 'object') {
      if (Array.isArray(value.results)) {
        value.results.forEach((entry: any) => collectInlineTermLabels(entry, map));
      }

      const guid = value.TermGuid || value.termGuid || value.Id || value.id;
      const label = value.Label || value.label || value.Title || value.title || value.name;
      if (guid && typeof guid === 'string' && label && !TENANT_CONFIG.patterns.guidExact.test(String(label).trim())) {
        const guidMatches = guid.match(TENANT_CONFIG.patterns.guid);
        (guidMatches || []).forEach(matchedGuid => {
          map[matchedGuid.toLowerCase()] = String(label).trim();
        });
      }
    }
  };

  const uniqueLabels = (values: string[]): string[] => {
    const seen = new Set<string>();
    const output: string[] = [];
    values.forEach(value => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      output.push(trimmed);
    });
    return output;
  };

  const getEntityLabels = (value: any): string[] => {
    const guids = new Set<string>();
    const inlineLabels: Record<string, string> = {};
    collectTermGuids(value, guids);
    collectInlineTermLabels(value, inlineLabels);

    const labelsFromGuids = Array.from(guids)
      .map(guid => entityTerms[guid] || inlineLabels[guid] || '')
      .filter(label => Boolean(label) && !TENANT_CONFIG.patterns.guidExact.test(String(label).trim()))
      .map(label => String(label).trim());

    if (labelsFromGuids.length) {
      return uniqueLabels(labelsFromGuids);
    }

    const parsed = parseTaxonomyLabel(value);
    if (parsed === '—') {
      return [];
    }

    return uniqueLabels(
      parsed
        .split(',')
        .map(part => part.trim())
        .filter(part => part && !TENANT_CONFIG.patterns.guidExact.test(part))
    );
  };

  const renderEntity = (task: any): string => {
    const raw = task.RelatedEntity || task.ReletedEntity;
    const labels = getEntityLabels(raw);
    return labels.length ? labels.join(', ') : '—';
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

  const getAssignedToValue = (task: any): any =>
    task.AssignedTo1 || task.AssignedTo;

  const getDueDateValue = (task: any): any =>
    task.DueDate1 || task.DueDate;

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

  const loadEntityTerms = async (taskItems: any[]): Promise<void> => {
    const entityGuids = new Set<string>();
    taskItems.forEach(task => collectTermGuids(task.RelatedEntity || task.ReletedEntity, entityGuids));

    if (!entityGuids.size) {
      setEntityTerms({});
      return;
    }

    const map = await fetchTermLabelMap(
      webUrl,
      TENANT_CONFIG.termStore.sets.entities,
      entityGuids
    );

    setEntityTerms(map);
  };

  /* ---------------- MAIN LOAD ---------------- */
  // NOTE: loadTasks is now declared BEFORE it gets called by the popup functions!

  const loadTasks = async () => {
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

      const clientData = await fetchJson(
        `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.clients.title)}(${clientId})?$select=${TENANT_CONFIG.lists.clients.queries.relatedClientSelect}`
      );

      const extractTermGuids = (val: any): string[] => {
        const guids = new Set<string>();
        collectTermGuids(val, guids);
        return Array.from(guids);
      };

      const relatedClientGuids = extractTermGuids(clientData.RelatedClient);

      const clientGuidsToMatch = new Set<string>([
        clientTermGuid.toLowerCase(),
        ...relatedClientGuids
      ]);

      if (!clientGuidsToMatch.size) {
        setTasks([]);
        return;
      }

      const replaceInternalName = (
        source: string,
        from: string,
        to: string
      ): string => source.replace(new RegExp(`\\b${from}\\b`, 'g'), to);

      const stripSelectToken = (select: string, token: string): string => {
        const filtered = select
          .split(',')
          .map(part => part.trim())
          .filter(part => part && part.toLowerCase() !== token.toLowerCase());
        return filtered.join(',');
      };

      const safeSelectCandidates = [
        'Id,Title,Status,Priority,RelatedClient,RelatedEntity,DueDate1',
        'Id,Title,Status,Priority,RelatedClient,RelatedEntity,DueDate',
        'Id,Title,Status,Priority,RelatedClient,RelatedEntity',
        'Id,Title,Status,Priority,RelatedClient,DueDate1',
        'Id,Title,Status,Priority,RelatedClient,DueDate',
        'Id,Title,Status,Priority,RelatedClient'
      ];

      const baseSelectCandidates = [
        ...safeSelectCandidates,
        TENANT_CONFIG.lists.tasks.queries.listSelect,
        replaceInternalName(TENANT_CONFIG.lists.tasks.queries.listSelect, 'DueDate1', 'DueDate'),
        replaceInternalName(TENANT_CONFIG.lists.tasks.queries.listSelect, 'AssignedTo1', 'AssignedTo'),
        replaceInternalName(
          replaceInternalName(TENANT_CONFIG.lists.tasks.queries.listSelect, 'DueDate1', 'DueDate'),
          'AssignedTo1',
          'AssignedTo'
        )
      ];

      const selectCandidatesSet = new Set<string>();
      baseSelectCandidates.forEach(base => {
        const variants = [
          base,
          stripSelectToken(base, 'AssignedTo1/EMail'),
          stripSelectToken(base, 'AssignedTo/EMail'),
          stripSelectToken(
            stripSelectToken(base, 'AssignedTo1/EMail'),
            'AssignedTo1/Title'
          ),
          stripSelectToken(
            stripSelectToken(base, 'AssignedTo/EMail'),
            'AssignedTo/Title'
          )
        ];

        variants.forEach(variant => {
          const normalized = variant
            .replace(/,{2,}/g, ',')
            .replace(/^,|,$/g, '')
            .trim();
          if (normalized) {
            selectCandidatesSet.add(normalized);
          }
        });
      });

      const selectCandidates = Array.from(selectCandidatesSet);

      const expandCandidates = Array.from(
        new Set([
          TENANT_CONFIG.lists.tasks.queries.listExpand,
          replaceInternalName(TENANT_CONFIG.lists.tasks.queries.listExpand, 'AssignedTo1', 'AssignedTo'),
          ''
        ])
      );

      let allTasks: any[] = [];
      let lastTaskError: Error | null = null;

      for (const select of selectCandidates) {
        const hasAssignedProjection = /AssignedTo(?:1)?\//i.test(select);
        const candidateExpandList = hasAssignedProjection ? expandCandidates : [''];

        for (const expand of candidateExpandList) {
          try {
            const expandPart = expand ? `$expand=${expand}&` : '';
            const taskData = await fetchJson(
              `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.tasks.title)}?` +
                `$select=${select}&` +
                `${expandPart}` +
                `$top=${TENANT_CONFIG.queryLimits.listTop}`
            );
            allTasks = taskData.value || [];
            lastTaskError = null;
            break;
          } catch (error) {
            lastTaskError = error instanceof Error ? error : new Error(String(error));
          }
        }

        if (!lastTaskError) {
          break;
        }
      }

      if (lastTaskError) {
        throw lastTaskError;
      }

      const filtered = allTasks.filter((task: any) => {
        const taskClientGuids = new Set(extractTermGuids(task.RelatedClient));
        let isMatch = false;
        taskClientGuids.forEach(guid => {
          if (clientGuidsToMatch.has(guid)) {
            isMatch = true;
          }
        });
        return isMatch;
      });

      await loadEntityTerms(filtered);
      setTasks(filtered);
    } catch (err) {
      console.error('Tasks load error', err);
      setError(err instanceof Error ? `Failed to load tasks: ${err.message}` : 'Failed to load tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!clientId || !clientTermGuid) {
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }

    void loadTasks();
  }, [clientId, clientTermGuid]);


  /* ---------------- POPUP HANDLING ---------------- */
  // NOTE: Moved down here so they can safely call loadTasks() 

  const openAddNewTask = (): void => {
    setShowAddPopup(true);
  };

  const closeAddTask = () => {
    setShowAddPopup(false);
    void loadTasks();
  };

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    try {
      const iframe = e.target as HTMLIFrameElement;
      const iframeWindow = iframe.contentWindow;
      const iframeUrl = iframeWindow?.location.href || '';
      
      if (!iframeUrl || iframeUrl === 'about:blank') return;

      const urlLower = iframeUrl.toLowerCase();
      
      // 1. FALLBACK: Close only when the iframe actually navigates to AllItems.aspx
      // (ignore the AllItems.aspx that appears in the Source querystring of NewForm.aspx)
      let pathLower = '';
      try {
        pathLower = new URL(iframeUrl).pathname.toLowerCase();
      } catch {
        /* ignore parse errors */
      }
      if (pathLower.endsWith('/allitems.aspx') || pathLower.endsWith('allitems.aspx')) {
        closeAddTask();
        return;
      }

      // 1b. If the iframe navigates away from the original NewForm.aspx path, close it (cancel/save)
      if (taskFormPathRef.current && pathLower && pathLower !== taskFormPathRef.current) {
        closeAddTask();
        return;
      }

      // 2. CSS INJECTION + CANCEL WIRING: fix scrollbars, hide ribbon, and hook cancel buttons
      if (iframeWindow && iframeWindow.document) {
        const style = iframeWindow.document.createElement('style');
        style.innerHTML = `
          /* Fix the missing scrollbars */
          body, #s4-workspace {
            overflow: auto !important;
            overflow-y: auto !important;
            height: 100% !important;
          }
          /* Hide the top ribbon and title area */
          #s4-ribbonrow, #s4-titlerow {
            display: none !important;
          }
        `;
        iframeWindow.document.head.appendChild(style);

        // Try to catch the Cancel button directly to close the popup immediately.
        const wireCancelButtons = () => {
          const doc = iframeWindow.document;
          const selectors = [
            "input[id$='CancelButton']",
            "input[id$='GoBack']",
            "a[id$='DlgClose']",
            "button[id*='Cancel']",
            "button[id*='cancel']"
          ];
          selectors.forEach(sel => {
            doc.querySelectorAll(sel).forEach(el => {
              el.addEventListener('click', () => {
                // Delay a tick to allow any native handlers to run first
                setTimeout(() => {
                  closeAddTask();
                }, 50);
              });
            });
          });
        };

        wireCancelButtons();
      }

      // 3. FAST CLOSE: Catch the unload event the moment Save/Cancel is clicked
      if (urlLower.indexOf('listform.aspx') !== -1 || urlLower.indexOf('newform.aspx') !== -1) {
        if (iframeWindow) {
          iframeWindow.addEventListener('unload', () => {
            setTimeout(() => {
              closeAddTask();
            }, 150);
          });
        }
      }
    } catch (error) {
      console.warn("Iframe load check (Safe to ignore on cross-origin redirects):", error);
    }
  };

  // Cache the normalized path of the New Task form to detect navigation changes
  React.useEffect(() => {
    try {
      taskFormPathRef.current = new URL(TENANT_CONFIG.lists.tasks.newItemFormUrl).pathname.toLowerCase();
    } catch {
      taskFormPathRef.current = '';
    }
  }, []);


  /* ---------------- SORTING & FILTERING ---------------- */

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
        String(renderAssignedTo(getAssignedToValue(task)) || ''),
        String(getDueDateValue(task) || ''),
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
        const av = renderAssignedTo(getAssignedToValue(a)).toLowerCase();
        const bv = renderAssignedTo(getAssignedToValue(b)).toLowerCase();
        return av.localeCompare(bv) * dir;
      }

      if (key === 'DueDate') {
        const av = new Date(getDueDateValue(a) || '').getTime();
        const bv = new Date(getDueDateValue(b) || '').getTime();
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

  /* ---------------- RENDER ---------------- */

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
            setPriorityFilter(TENANT_CONFIG.ui.tasks.priorityFilters[0]);
          }}
        >
          Clear Search
        </button>
        <button
          type="button"
          className={styles.addBtn}
          onClick={openAddNewTask}
        >
          + Add New
        </button>
      </div>

      <div className={styles.filters}>
        {TENANT_CONFIG.ui.tasks.priorityFilterButtons.map(filter => (
          <button
            key={filter.value}
            type="button"
            className={`${styles.filterBtn} ${priorityFilter === filter.value ? styles.active : ''}`}
            onClick={() => setPriorityFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
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
                sortConfig.key === 'DueDate' ? styles[`sort${sortConfig.direction}`] : ''
              }`}
              onClick={() => handleSort('DueDate')}
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
                <div>{renderAssignedTo(getAssignedToValue(t))}</div>
                <div>{formatDate(getDueDateValue(t))}</div>
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
              <span>New item</span>
              <button
                type="button"
                className={styles.popupClose}
                onClick={closeAddTask}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <iframe
              title="Add New Task"
              src={TENANT_CONFIG.lists.tasks.newItemFormUrl}
              className={styles.popupFrame}
              onLoad={handleIframeLoad} 
              scrolling="yes"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksTab;
