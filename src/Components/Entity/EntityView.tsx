import * as React from 'react';
import layoutStyles from '../../webparts/greenVilleClient/components/GreenVilleClient.module.scss';
import leftPanelStyles from '../Clients/LeftPanel.module.scss';
import rightPanelStyles from '../Clients/RightPanel.module.scss';
import styles from './EntityView.module.scss';
import type { EntitySelection } from '../Clients/RightPanelTabs/EntitiesTab';
import EntitySummaryTab from './Tabs/EntitySummaryTab';
import EntityDocumentsTab from './Tabs/EntityDocumentsTab';
import EntityTasksTab from './Tabs/EntityTasksTab';
import {
  TENANT_CONFIG,
  buildListItemsApiUrl,
  fetchTermLabelMap,
  type EntityPanelTab
} from '../../config/tenantConfig';
import { loadGreenvilleMetadataCache } from '../../services/metadataCacheService';
import { findTermByLabel } from '../../services/taxonomyService';

const DEBUG_PREFIX = '[Greenville Debug]';

type EntityTabKey = EntityPanelTab;

interface EntityViewProps {
  webUrl: string;
  initialEntity: EntitySelection | null;
  onEntityChange?: (entity: EntitySelection) => void;
}

const parseEntityEntries = (value: any): Array<{ guid: string; label: string }> => {
  if (!value) return [];

  if (typeof value === 'string') {
    const entries: Array<{ guid: string; label: string }> = [];

    value
      .split(';#')
      .map(token => token.trim())
      .filter(Boolean)
      .forEach(token => {
        if (token.includes('|')) {
          const parts = token.split('|');
          const label = String(parts[0] || '').trim();
          const guid = String(parts[1] || '').trim().toLowerCase();
          if (TENANT_CONFIG.patterns.guidExact.test(guid)) {
            entries.push({ guid, label });
          }
          return;
        }

        const guid = token.toLowerCase();
        if (TENANT_CONFIG.patterns.guidExact.test(guid)) {
          entries.push({ guid, label: '' });
        }
      });

    return entries;
  }

  if (Array.isArray(value)) {
    const entries: Array<{ guid: string; label: string }> = [];
    value.forEach(v => {
      entries.push(...parseEntityEntries(v));
    });
    return entries;
  }

  if (typeof value === 'object') {
    const guid = String(
      value.TermGuid || value.termGuid || value.id || value.Id || ''
    )
      .trim()
      .toLowerCase();
    const label = String(
      value.Label || value.label || value.Title || value.name || ''
    ).trim();

    if (TENANT_CONFIG.patterns.guidExact.test(guid)) {
      return [{ guid, label }];
    }
  }

  return [];
};

const isReadableEntityLabel = (value: string): boolean => {
  const text = String(value || '').trim();
  if (!text) return false;
  if (TENANT_CONFIG.patterns.guidExact.test(text)) return false;
  if (/^\d+$/.test(text)) return false;
  return true;
};

const EntityView: React.FC<EntityViewProps> = ({
  webUrl,
  initialEntity,
  onEntityChange
}) => {
  const [activeTab, setActiveTab] = React.useState<EntityTabKey>(
    TENANT_CONFIG.ui.tabs.entityPanel[0]
  );
  const [selectedEntity, setSelectedEntity] = React.useState<EntitySelection | null>(initialEntity);
  const [entities, setEntities] = React.useState<EntitySelection[]>([]);
  const [loadingEntities, setLoadingEntities] = React.useState(true);
  const [showAddPopup, setShowAddPopup] = React.useState(false);
  const [newFormUrl, setNewFormUrl] = React.useState<string | null>(null);
  const [formLoading, setFormLoading] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const selectedEntityRef = React.useRef<EntitySelection | null>(initialEntity);
  const cancelledRef = React.useRef(false);

  React.useEffect(() => {
    selectedEntityRef.current = selectedEntity;
  }, [selectedEntity]);

  React.useEffect(() => {
    setSelectedEntity(initialEntity);
    selectedEntityRef.current = initialEntity;
  }, [initialEntity]);

  const loadEntities = React.useCallback(async () => {
    try {
      if (cancelledRef.current) return;
      console.log(`${DEBUG_PREFIX} Entity view list load started`, { initialEntity });
      setLoadingEntities(true);

      const fetchJson = async (url: string) => {
        const resp = await fetch(url, {
          headers: { Accept: 'application/json;odata=nometadata' }
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.json();
      };

      const data = await fetchJson(
        `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.entities.title)}?` +
          `$select=${TENANT_CONFIG.lists.entities.queries.listSelect},Title&$top=${TENANT_CONFIG.queryLimits.listTop}`
      );

      const matched = data.value || [];

      if (!matched.length) {
        if (!cancelledRef.current) {
          setEntities([]);
          setSelectedEntity(null);
        }
        return;
      }

      const entityGuids = new Set<string>();
      const guidToItemId = new Map<string, number>();
      const fallbackLabelByGuid = new Map<string, string>();

      matched.forEach((item: any) => {
        const titleFallback = String(item.Title || '').trim();
        parseEntityEntries(item.Entity).forEach(entry => {
          entityGuids.add(entry.guid);
          if (!guidToItemId.has(entry.guid)) {
            guidToItemId.set(entry.guid, item.Id);
          }
          if (isReadableEntityLabel(entry.label) && !fallbackLabelByGuid.has(entry.guid)) {
            fallbackLabelByGuid.set(entry.guid, entry.label);
          } else if (isReadableEntityLabel(titleFallback) && !fallbackLabelByGuid.has(entry.guid)) {
            fallbackLabelByGuid.set(entry.guid, titleFallback);
          }
        });
      });

      const termLabelMap = await fetchTermLabelMap(
        webUrl,
        TENANT_CONFIG.termStore.sets.entities,
        entityGuids
      );

      const labelMap = new Map<string, string>();
      Object.keys(termLabelMap).forEach(id => {
        const label = termLabelMap[id];
        if (label) {
          labelMap.set(id, label);
        }
      });

      const metadataCache = await loadGreenvilleMetadataCache(webUrl);
      const list: EntitySelection[] = [];
      entityGuids.forEach(guid => {
        const mapped = labelMap.get(guid) || '';
        const fallback = fallbackLabelByGuid.get(guid) || '';
        const label = isReadableEntityLabel(mapped)
          ? mapped
          : isReadableEntityLabel(fallback)
            ? fallback
            : guid;
        const docCenterTerm = findTermByLabel(metadataCache.docCenterEntities, label);

        list.push({
          id: guidToItemId.get(guid),
          termGuid: guid,
          docCenterTermGuid: docCenterTerm?.id || null,
          label,
          relatedClientGuid: initialEntity?.relatedClientGuid || ''
        });
      });

      list.sort((a, b) => a.label.localeCompare(b.label));

      if (cancelledRef.current) return;

      console.log(`${DEBUG_PREFIX} Entity view list loaded`, {
        count: list.length,
        entities: list
      });
      setEntities(list);
      setSelectedEntity(() => {
        const current = selectedEntityRef.current;
        const exists = current && list.some(e => e.termGuid === current.termGuid);
        if (exists) {
          return current;
        }
        const next = list[0] || null;
        selectedEntityRef.current = next;
        if (next) {
          onEntityChange?.(next);
        }
        return next;
      });
    } catch (err) {
      console.error('EntityView load error', err);
      if (!cancelledRef.current) {
        setEntities([]);
        setSelectedEntity(null);
      }
    } finally {
      if (!cancelledRef.current) {
        setLoadingEntities(false);
      }
    }
  }, [webUrl, initialEntity?.relatedClientGuid, onEntityChange]);

  React.useEffect(() => {
    cancelledRef.current = false;
    void loadEntities();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadEntities]);

  const handleSelectEntity = (entity: EntitySelection): void => {
    console.log(`${DEBUG_PREFIX} Entity view entity clicked`, entity);
    setSelectedEntity(entity);
    selectedEntityRef.current = entity;
    onEntityChange?.(entity);
  };

  const fetchNewFormUrl = async (): Promise<string | null> => {
    try {
      setFormError(null);
      setFormLoading(true);
      const absoluteUrl = TENANT_CONFIG.lists.entities.newItemFormUrl;
      setNewFormUrl(absoluteUrl);
      return absoluteUrl;
    } catch (err) {
      console.error('EntityView new form url error', err);
      setFormError('Unable to open the add entity form.');
      return null;
    } finally {
      setFormLoading(false);
    }
  };

  const openAddEntityForm = async () => {
    setShowAddPopup(true);
    if (!newFormUrl && !formLoading) {
      await fetchNewFormUrl();
    }
  };

  const closeAddEntityForm = () => {
    setShowAddPopup(false);
    setFormError(null);
    void loadEntities();
  };

  // NEW: Fast-close logic for the Entity iframe
  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    try {
      const iframe = e.target as HTMLIFrameElement;
      const iframeWindow = iframe.contentWindow;
      const iframeUrl = iframeWindow?.location.href;
      
      if (iframeUrl) {
        const urlObj = new URL(iframeUrl);
        
        // 1. FALLBACK: Close if it manages to load AllItems.aspx
        if (urlObj.pathname.toLowerCase().endsWith('allitems.aspx')) {
          closeAddEntityForm();
          return;
        }

        // 2. FAST CLOSE: Catch the unload event the moment Save/Cancel is clicked
        if (iframeWindow) {
          iframeWindow.addEventListener('unload', () => {
            setTimeout(() => {
              closeAddEntityForm();
            }, 100);
          });
        }
      }
    } catch (error) {
      console.warn("Iframe load check:", error);
    }
  };

  const renderTabContent = () => {
    if (!selectedEntity) {
      return (
        <div className={styles.placeholder}>
          <div className={styles.placeholderTitle}>No entity selected</div>
          <p>Select an entity on the left to view its tabs.</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'Summary':
        return <EntitySummaryTab webUrl={webUrl} entity={selectedEntity} />;
      case 'Documents':
        return <EntityDocumentsTab webUrl={webUrl} entity={selectedEntity} />;
      case 'Tasks':
        return <EntityTasksTab webUrl={webUrl} entity={selectedEntity} />;
      default:
        return null;
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={layoutStyles.layout}>
        <div className={`${layoutStyles.leftColumn} ${layoutStyles.panelWrapper}`}>
          <div className={leftPanelStyles.leftPanel}>
            <div className={leftPanelStyles.panelHeader}>
              <span className={leftPanelStyles.headerTitle}>Entities</span>
              <button
                type="button"
                className={leftPanelStyles.addButton}
                onClick={openAddEntityForm}
                disabled={formLoading && !newFormUrl}
              >
                + Add New
              </button>
            </div>
            <div className={leftPanelStyles.clientList}>
              {loadingEntities && (
                <div className={styles.infoState}>Loading entities…</div>
              )}

              {!loadingEntities && !entities.length && (
                <div className={styles.infoState}>No related entities found</div>
              )}

              {!loadingEntities &&
                entities.map(entity => (
                  <button
                    key={entity.termGuid}
                    type="button"
                    className={`${leftPanelStyles.clientItem} ${
                      selectedEntity?.termGuid === entity.termGuid ? leftPanelStyles.active : ''
                    }`}
                    onClick={() => handleSelectEntity(entity)}
                  >
                    <span className={leftPanelStyles.clientName}>{entity.label}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className={`${layoutStyles.rightColumn} ${layoutStyles.panelWrapper}`}>
          <div className={rightPanelStyles.rightPanel}>
            {selectedEntity && (
              <div className={rightPanelStyles.clientHeader}>
                <h2>{selectedEntity.label}</h2>
              </div>
            )}
            <div className={rightPanelStyles.tabs}>
              {TENANT_CONFIG.ui.tabs.entityPanel.map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`${rightPanelStyles.tab} ${
                    activeTab === tab ? rightPanelStyles.activeTab : ''
                  }`}
                  onClick={() => {
                    console.log(`${DEBUG_PREFIX} Entity panel tab clicked`, {
                      tab,
                      selectedEntity
                    });
                    setActiveTab(tab);
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className={rightPanelStyles.tabContent}>{renderTabContent()}</div>
          </div>
        </div>
      </div>

      {showAddPopup && (
        <div
          className={leftPanelStyles.popupOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Add new entity"
        >
          <div className={leftPanelStyles.popupCard}>
            <div className={leftPanelStyles.popupHeader}>
              <span>Add New Entity</span>
              <button
                type="button"
                className={leftPanelStyles.popupClose}
                aria-label="Close add entity form"
                onClick={closeAddEntityForm}
              >
                ×
              </button>
            </div>
            {formError ? (
              <div className={styles.infoState}>{formError}</div>
            ) : formLoading && !newFormUrl ? (
              <div className={styles.infoState}>Preparing form…</div>
            ) : newFormUrl ? (
              <iframe
                title="Add New Entity"
                src={newFormUrl}
                className={leftPanelStyles.popupFrame}
                onLoad={handleIframeLoad} // NEW: Added onLoad listener here
              />
            ) : (
              <div className={styles.infoState}>Form URL not available.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityView;
