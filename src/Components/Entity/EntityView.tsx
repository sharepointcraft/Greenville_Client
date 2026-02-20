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
  buildTermSetTermsApiUrl,
  type EntityPanelTab
} from '../../config/tenantConfig';

type EntityTabKey = EntityPanelTab;

interface EntityViewProps {
  webUrl: string;
  initialEntity: EntitySelection | null;
  onEntityChange?: (entity: EntitySelection) => void;
}

const collectTermGuids = (value: any, set: Set<string>) => {
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

  if (value.TermGuid) {
    set.add(String(value.TermGuid).toLowerCase());
  }
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
          `$select=${TENANT_CONFIG.lists.entities.queries.listSelect}&$top=${TENANT_CONFIG.queryLimits.listTop}`
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

      matched.forEach((item: any) => {
        const guids = new Set<string>();
        collectTermGuids(item.Entity, guids);
        guids.forEach(g => {
          entityGuids.add(g);
          if (!guidToItemId.has(g)) {
            guidToItemId.set(g, item.Id);
          }
        });
      });

      const termData = await fetchJson(
        buildTermSetTermsApiUrl(webUrl, TENANT_CONFIG.termStore.sets.entities)
      );

      const labelMap = new Map<string, string>();
      (termData.value || []).forEach((t: any) => {
        const id = String(t.id).toLowerCase();
        if (entityGuids.has(id)) {
          const label =
            t.labels?.find((l: any) => l.isDefault)?.name ||
            t.labels?.[0]?.name;
          if (label) {
            labelMap.set(id, label);
          }
        }
      });

      const list: EntitySelection[] = [];
      entityGuids.forEach(guid => {
        list.push({
          id: guidToItemId.get(guid),
          termGuid: guid,
          label: labelMap.get(guid) || guid,
          relatedClientGuid: initialEntity?.relatedClientGuid || ''
        });
      });

      list.sort((a, b) => a.label.localeCompare(b.label));

      if (cancelledRef.current) return;

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
                  onClick={() => setActiveTab(tab)}
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
