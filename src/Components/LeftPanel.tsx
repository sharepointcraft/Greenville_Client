import * as React from 'react';
import { SPHttpClient } from '@microsoft/sp-http';
import styles from './LeftPanel.module.scss';

interface LeftPanelProps {
  webUrl: string;
  selectedClientId: number | null;
  onSelect: (id: number, termGuid: string) => void;
}

interface IClientUsage {
  itemId: number;
  termGuid: string;
}

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const TERM_SET_ID = 'e15c7ba0-e449-437f-bb70-b35bc582edda';
const ADD_NEW_CLIENT_URL =
  'https://realitycraftprivatelimited.sharepoint.com/sites/Prod-Home/_layouts/15/listform.aspx?PageType=8&ListId=%7BD055FA58-F79D-496A-A914-35E21B3675A9%7D&RootFolder=%2Fsites%2FProd-Home%2FLists%2FClients&Source=https%3A%2F%2Frealitycraftprivatelimited.sharepoint.com%2Fsites%2FProd-Home%2FLists%2FClients%2FAllItems.aspx&ContentTypeId=0x0100C441AE8AC3A035499BD4A40EF481581600FD2764DABCAC504483BC664D29A7796D';

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
      /* 1️⃣ Load Clients list items */
      const listResp = await fetch(
        `${webUrl}/_api/web/lists/getByTitle('Clients')/items?$select=Id,Client`,
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

      /* 2️⃣ Load Term Store */
      const termResp = await fetch(
        `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${TERM_SET_ID}')/terms`,
        { headers: { Accept: 'application/json' } }
      );

      const termData = await termResp.json();

      const termMap = new Map<string, string>();
      termData.value.forEach((t: any) => {
        termMap.set(t.id.toLowerCase(), t.labels[0].name);
      });

      /* 3️⃣ Build final client list */
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
        onSelect(finalItems[0].id, finalItems[0].termGuid);
      }
    } catch (err) {
      console.error('LeftPanel load error:', err);
      setItems([]);
    }
  };

  React.useEffect(() => {
    void loadClientsFromTerms();
  }, []);

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
            onClick={() => onSelect(client.id, client.termGuid)}
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
              src={ADD_NEW_CLIENT_URL}
              className={styles.popupFrame}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default LeftPanel;
