import * as React from 'react';
import styles from './LeftPanel.module.scss';
import {
  TENANT_CONFIG,
  buildListItemsApiUrl,
  buildTermSetTermsApiUrl
} from '../../config/tenantConfig';

interface LeftPanelProps {
  webUrl: string;
  selectedClientId: number | null;
  onSelect: (id: number, termGuid: string, label: string) => void;
}

interface IClientUsage {
  itemId: number;
  termGuid: string;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  webUrl,
  selectedClientId,
  onSelect
}) => {
  const [items, setItems] = React.useState<
    { id: number; label: string; termGuid: string }[]
  >([]);
  const [showAddPopup, setShowAddPopup] = React.useState(false);

  const loadClientsFromTerms = async () => {
    try {
      const listResp = await fetch(
        `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.clients.title)}?$select=${TENANT_CONFIG.lists.clients.queries.leftPanelSelect}`,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

      const listData = await listResp.json();

      const usedTerms: IClientUsage[] = (listData.value || [])
        .map((item: any) => {
          const term = item.Client;
          if (!term?.TermGuid) return null;
          return {
            itemId: item.Id,
            termGuid: term.TermGuid
          };
        })
        .filter(Boolean);

      if (!usedTerms.length) {
        setItems([]);
        return;
      }

      const termResp = await fetch(
        buildTermSetTermsApiUrl(webUrl, TENANT_CONFIG.termStore.sets.clients),
        { headers: { Accept: 'application/json' } }
      );

      const termData = await termResp.json();

      const termMap = new Map<string, string>();
      termData.value.forEach((t: any) => {
        termMap.set(t.id.toLowerCase(), t.labels[0].name);
      });

      const finalItems = usedTerms
        .filter(u => termMap.has(u.termGuid.toLowerCase()))
        .map(u => ({
          id: u.itemId,
          label: termMap.get(u.termGuid.toLowerCase())!,
          termGuid: u.termGuid
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      setItems(finalItems);

      if (finalItems.length && selectedClientId === null) {
        const first = finalItems[0];
        onSelect(first.id, first.termGuid, first.label);
      }
    } catch (err) {
      console.error('LeftPanel load error:', err);
      setItems([]);
    }
  };

  React.useEffect(() => {
    void loadClientsFromTerms();
  }, []);

  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement, Event>) => {
    try {
      const iframe = e.target as HTMLIFrameElement;
      const iframeWindow = iframe.contentWindow;
      const iframeUrl = iframeWindow?.location.href;
      
      if (iframeUrl) {
        const urlObj = new URL(iframeUrl);
        
        // 1. FALLBACK: If the list view somehow fully loads, close it normally.
        if (urlObj.pathname.toLowerCase().endsWith('allitems.aspx')) {
          setShowAddPopup(false);
          void loadClientsFromTerms();
          return;
        }

        // 2. FAST CLOSE: When the list form starts to leave after clicking Save/Cancel, close instantly.
        if (iframeWindow) {
          iframeWindow.addEventListener('unload', () => {
            // A tiny 100ms delay ensures SharePoint finishes sending the Save data before we destroy the popup
            setTimeout(() => {
              setShowAddPopup(false);
              void loadClientsFromTerms();
            }, 100);
          });
        }
      }
    } catch (error) {
      console.warn("Iframe load check:", error);
    }
  };

  return (
    <div className={styles.leftPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.headerTitle}>Clients</span>
        <button
          className={styles.addButton}
          type="button"
          onClick={() => setShowAddPopup(true)}
        >
          + Add New
        </button>
      </div>

      <div className={styles.clientList}>
        {items.map(client => (
          <button
            key={client.id}
            type="button"
            className={`${styles.clientItem} ${
              client.id === selectedClientId ? styles.active : ''
            }`}
            onClick={() => onSelect(client.id, client.termGuid, client.label)}
          >
            {client.label}
          </button>
        ))}
      </div>

      {showAddPopup && (
        <div className={styles.popupOverlay} role="dialog" aria-modal="true" aria-label="Add new client">
          <div className={styles.popupCard}>
            <div className={styles.popupHeader}>
              <span>New item</span>
              <button
                type="button"
                className={styles.popupClose}
                onClick={() => {
                  setShowAddPopup(false);
                  void loadClientsFromTerms();
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <iframe
              title="Add New Client"
              src={TENANT_CONFIG.lists.clients.newItemFormUrl}
              className={styles.popupFrame}
              onLoad={handleIframeLoad} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LeftPanel;
