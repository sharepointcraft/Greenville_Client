import * as React from 'react';
import styles from './EntitiesTab.module.scss';
import {
  TENANT_CONFIG,
  buildListItemsApiUrl,
  fetchTermLabelMap
} from '../../../config/tenantConfig';

export interface EntitySelection {
  id?: number;
  termGuid: string;
  label: string;
  relatedClientGuid: string;
}

interface EntitiesTabProps {
  webUrl: string;
  clientTermGuid: string;
  onEntityClick?: (entity: EntitySelection) => void;
}

const EntitiesTab: React.FC<EntitiesTabProps> = ({
  webUrl,
  clientTermGuid,
  onEntityClick
}) => {
  const [entities, setEntities] = React.useState<EntitySelection[]>([]);
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
        `${buildListItemsApiUrl(webUrl, TENANT_CONFIG.lists.entities.title)}?` +
          `$select=${TENANT_CONFIG.lists.entities.queries.listSelect}&$top=${TENANT_CONFIG.queryLimits.listTop}`
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
      const guidToItemId = new Map<string, number>();
      matchedEntities.forEach(e => {
        const guids = new Set<string>();
        collectTermGuids(e.Entity, guids);
        guids.forEach(g => {
          entityGuids.add(g);
          if (!guidToItemId.has(g)) {
            guidToItemId.set(g, e.Id);
          }
        });
      });

      /* 4️⃣ Resolve Entity names */
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

      const items: EntitySelection[] = [];
      entityGuids.forEach(guid => {
        items.push({
          id: guidToItemId.get(guid),
          termGuid: guid,
          label: labelMap.get(guid) || guid,
          relatedClientGuid: clientTermGuid
        });
      });

      const unique = Array.from(
        new Map(items.map(item => [item.termGuid, item])).values()
      );

      unique.sort((a, b) => a.label.localeCompare(b.label));
      setEntities(unique);
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
  }, [clientTermGuid, webUrl]);

  /* ---------------- RENDER ---------------- */

  const renderEntities = () => {
    if (loading) {
      return <div className={styles.loading}>Loading entities…</div>;
    }

    if (!entities.length) {
      return <div className={styles.empty}>No related entities found</div>;
    }

    return (
      <div className={styles.list}>
        {entities.map(entity => (
          <button
            key={entity.termGuid}
            type="button"
            className={styles.entityButton}
            onClick={() => onEntityClick?.(entity)}
          >
            {entity.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {renderEntities()}
    </div>
  );
};

export default EntitiesTab;
