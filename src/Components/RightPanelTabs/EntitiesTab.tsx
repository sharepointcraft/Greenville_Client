import * as React from 'react';
import styles from './EntitiesTab.module.scss';
 
const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const ENTITY_TERM_SET_ID = '63f8136b-40cf-4d43-890a-73d4959c5a68';
 
interface EntitiesTabProps {
  webUrl: string;
  clientTermGuid: string;
}
 
const EntitiesTab: React.FC<EntitiesTabProps> = ({
  webUrl,
  clientTermGuid
}) => {
  const [entities, setEntities] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
 
  /* ---------------- TAXONOMY HELPERS ---------------- */
 
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
 
  /* ---------------- LOAD ENTITIES ---------------- */
 
  const loadEntities = async () => {
    try {
      setLoading(true);
 
      const fetchJson = async (url: string) => {
        const r = await fetch(url, {
          headers: { Accept: 'application/json;odata=nometadata' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      };
 
      /* 1️⃣ Load all entities */
      const data = await fetchJson(
        `${webUrl}/_api/web/lists/getByTitle('Entities')/items?` +
          `$select=Id,Entity,RelatedClient&$top=5000`
      );
 
      const matchedEntities: any[] = [];
 
      /* 2️⃣ Filter by selected client */
      data.value.forEach((item: any) => {
        const clientGuids = new Set<string>();
        collectTermGuids(item.RelatedClient, clientGuids);
 
        if (clientGuids.has(clientTermGuid.toLowerCase())) {
          matchedEntities.push(item);
        }
      });
 
      if (!matchedEntities.length) {
        setEntities([]);
        return;
      }
 
      /* 3️⃣ Collect Entity term GUIDs */
      const entityGuids = new Set<string>();
      matchedEntities.forEach(e =>
        collectTermGuids(e.Entity, entityGuids)
      );
 
      /* 4️⃣ Resolve Entity names */
      const termData = await fetchJson(
        `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${ENTITY_TERM_SET_ID}')/terms`
      );
 
      const labels: string[] = [];
      (termData.value || []).forEach((t: any) => {
        if (entityGuids.has(String(t.id).toLowerCase())) {
          const label =
            t.labels?.find((l: any) => l.isDefault)?.name ||
            t.labels?.[0]?.name;
          if (label) labels.push(label);
        }
      });
 
      setEntities(labels.sort());
    } catch (err) {
      console.error('Entities load error', err);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  };
 
  React.useEffect(() => {
    if (!clientTermGuid) {
      setEntities([]);
      setLoading(false);
      return;
    }
    void loadEntities();
  }, [clientTermGuid]);
 
  /* ---------------- RENDER ---------------- */
 
  if (loading) {
    return <div className={styles.loading}>Loading entities…</div>;
  }
 
  if (!entities.length) {
    return <div className={styles.empty}>No related entities found</div>;
  }
 
  return (
    <div className={styles.container}>
      {entities.map(name => (
        <div key={name} className={styles.entityItem}>
          {name}
        </div>
      ))}
    </div>
  );
};
 
export default EntitiesTab;
 