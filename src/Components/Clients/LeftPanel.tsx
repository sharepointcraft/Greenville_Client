import * as React from 'react';
import styles from './LeftPanel.module.scss';
import {
  TENANT_CONFIG,
  buildListItemsApiUrl,
  fetchTermLabelMap
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
  alias: string;
  title: string;
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

  const isGuid = (value: string): boolean =>
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());

  const isNumeric = (value: string): boolean => /^\d+$/.test(value.trim());

  const isReadableName = (value?: string): boolean => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (isGuid(text)) return false;
    if (isNumeric(text)) return false;
    return true;
  };

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
      const listBaseUrl = buildListItemsApiUrl(
        webUrl,
        TENANT_CONFIG.lists.clients.title
      );
      const withAliasSelect =
        `${TENANT_CONFIG.lists.clients.queries.leftPanelSelect},Title,EntityAliases`;
      const withoutAliasSelect =
        `${TENANT_CONFIG.lists.clients.queries.leftPanelSelect},Title`;

      const fetchListData = async (select: string): Promise<any> => {
        const listResp = await fetch(`${listBaseUrl}?$select=${select}`, {
          headers: { Accept: 'application/json;odata=nometadata' }
        });

        if (!listResp.ok) {
          const detail = await listResp.text();
          throw new Error(
            `Clients list request failed (${listResp.status}): ${detail || listResp.statusText}`
          );
        }

        return listResp.json();
      };

      let listData: any;
      try {
        listData = await fetchListData(withAliasSelect);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('(400)')) {
          throw error;
        }

        // Some tenant schemas may not expose EntityAliases. Fallback to base columns.
        listData = await fetchListData(withoutAliasSelect);
      }

      const usedTerms: IClientUsage[] = (listData.value || [])
        .map((item: any) => {
          const term = parseClientTerm(item.Client);
          if (!term?.termGuid) return null;

          const fallbackLabel = String(item.Title || '').trim();
          const alias = String(item.EntityAliases || '').trim();
          return {
            itemId: item.Id,
            termGuid: term.termGuid,
            label: term.label || fallbackLabel,
            alias,
            title: fallbackLabel
          };
        })
        .filter(Boolean);

      if (!usedTerms.length) {
        setItems([]);
        return;
      }

      const termMap = new Map<string, string>();

      try {
        const targetGuids = new Set<string>(
          usedTerms.map(term => term.termGuid.toLowerCase())
        );
        const labels = await fetchTermLabelMap(
          webUrl,
          TENANT_CONFIG.termStore.sets.clients,
          targetGuids
        );

        Object.keys(labels).forEach(id => {
          const label = labels[id];
          if (label) {
            termMap.set(id, label);
          }
        });
      } catch (err) {
        console.warn('Client term-store lookup error:', err);
      }

      const finalItems = usedTerms
        .map(u => ({
          id: u.itemId,
          label: (() => {
            const mapped = termMap.get(u.termGuid.toLowerCase()) || '';
            if (isReadableName(mapped)) return mapped;
            if (isReadableName(u.label)) return u.label;
            if (isReadableName(u.alias)) return u.alias;
            if (isReadableName(u.title)) return u.title;
            return mapped || u.label || u.alias || u.title || `Client ${u.itemId}`;
          })(),
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
