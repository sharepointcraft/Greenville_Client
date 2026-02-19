import * as React from 'react';
import layoutStyles from '../../webparts/greenVilleClient/components/GreenVilleClient.module.scss';
import leftPanelStyles from '../Clients/LeftPanel.module.scss';
import rightPanelStyles from '../Clients/RightPanel.module.scss';
import styles from './EntityView.module.scss';
import type { EntitySelection } from '../Clients/RightPanelTabs/EntitiesTab';
import EntitySummaryTab from './Tabs/EntitySummaryTab';
import EntityDocumentsTab from './Tabs/EntityDocumentsTab';
import EntityTasksTab from './Tabs/EntityTasksTab';

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const ENTITY_TERM_SET_ID = '63f8136b-40cf-4d43-890a-73d4959c5a68';
const ENTITIES_NEW_FORM_URL =
  'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7B5B64CCEF-5176-4D1E-AFD2-BF67366BEA81%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FEntities&Source=https%3A%2F%2Frealitycraftprivatelimited.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FEntities%2FAllItems.aspx&ContentTypeId=0x010005A065D7CC77D146A540E9E94E26F332009595D5DD684D9F47BDF0DE601379CD13';

type EntityTabKey = 'Summary' | 'Documents' | 'Tasks';

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
  const [activeTab, setActiveTab] = React.useState<EntityTabKey>('Summary');
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
        `${webUrl}/_api/web/lists/getByTitle('Entities')/items?` +
          `$select=Id,Entity,RelatedClient&$top=5000`
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
        `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${ENTITY_TERM_SET_ID}')/terms`
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
      const absoluteUrl = ENTITIES_NEW_FORM_URL;
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
                + Add Entity
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
            <div className={rightPanelStyles.tabs}>
              {(['Summary', 'Documents', 'Tasks'] as EntityTabKey[]).map(tab => (
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
