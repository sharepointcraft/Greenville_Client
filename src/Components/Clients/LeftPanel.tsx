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
  label: string;
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

  const parseClientTerm = (
    value: any
  ): { termGuid: string; label: string } | null => {
    if (!value) return null;

    const guidPattern = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

    if (typeof value === 'string') {
      const guidMatch = value.match(guidPattern);
      if (!guidMatch?.[0]) return null;

      const guid = guidMatch[0];
      const labelMatch = value.match(/([^|;#]+)\|[0-9a-fA-F-]{36}/);
      const label = (labelMatch?.[1] || '').trim();

      return {
        termGuid: guid,
        label
      };
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const parsed = parseClientTerm(item);
        if (parsed) {
          return parsed;
        }
      }
      return null;
    }

    if (typeof value === 'object') {
      const guid = String(value.TermGuid || value.termGuid || '').trim();
      if (!guidPattern.test(guid)) {
        return null;
      }

      return {
        termGuid: guid,
        label: String(value.Label || value.label || value.Title || value.name || '').trim()
      };
    }

    return null;
  };

  const loadClientsFromTerms = async () => {
    try {
      const listResp = await fetch(
        `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.clients.title)}?$select=${TENANT_CONFIG.lists.clients.queries.leftPanelSelect},Title`,
        { headers: { Accept: 'application/json;odata=nometadata' } }
      );

      if (!listResp.ok) {
        const detail = await listResp.text();
        throw new Error(`Clients list request failed (${listResp.status}): ${detail || listResp.statusText}`);
      }

      const listData = await listResp.json();

      const usedTerms: IClientUsage[] = (listData.value || [])
        .map((item: any) => {
          const term = parseClientTerm(item.Client);
          if (!term?.termGuid) return null;

          const fallbackLabel = String(item.Title || '').trim();
          return {
            itemId: item.Id,
            termGuid: term.termGuid,
            label: term.label || fallbackLabel
          };
        })
        .filter(Boolean);

      if (!usedTerms.length) {
        setItems([]);
        return;
      }

      const termMap = new Map<string, string>();

      try {
        const termResp = await fetch(
          buildTermSetTermsApiUrl(webUrl, TENANT_CONFIG.termStore.sets.clients),
          { headers: { Accept: 'application/json' } }
        );

        if (termResp.ok) {
          const termData = await termResp.json();
          (termData.value || []).forEach((t: any) => {
            const id = String(t.id || '').toLowerCase();
            const defaultLabel =
              t.labels?.find((l: any) => l.isDefault)?.name ||
              t.labels?.[0]?.name;
            if (id && defaultLabel) {
              termMap.set(id, defaultLabel);
            }
          });
        } else {
          const detail = await termResp.text();
          console.warn(
            `Client term-store lookup failed (${termResp.status})`,
            detail || termResp.statusText
          );
        }
      } catch (err) {
        console.warn('Client term-store lookup error:', err);
      }

      const finalItems = usedTerms
        .map(u => ({
          id: u.itemId,
          label:
            termMap.get(u.termGuid.toLowerCase()) ||
            u.label ||
            `Client ${u.itemId}`,
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
