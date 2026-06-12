import * as React from 'react';
import styles from './EntitiesTab.module.scss';
import {
  TENANT_CONFIG,
  buildListItemsApiUrl,
  fetchTermLabelMap
} from '../../../config/tenantConfig';
import { loadGreenvilleMetadataCache } from '../../../services/metadataCacheService';
import { findTermByLabel } from '../../../services/taxonomyService';

const DEBUG_PREFIX = '[Greenville Debug]';

export interface EntitySelection {
  id?: number;
  termGuid: string;
  docCenterTermGuid?: string | null;
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

  const isReadableName = (value: string): boolean => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (TENANT_CONFIG.patterns.guidExact.test(text)) return false;
    if (/^\d+$/.test(text)) return false;
    return true;
  };

  /* ---------------- LOAD ENTITIES ---------------- */

  const loadEntities = async () => {
    try {
      console.log(`${DEBUG_PREFIX} Entity list load started`, { clientTermGuid });
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
          `$select=${TENANT_CONFIG.lists.entities.queries.listSelect},Title&$top=${TENANT_CONFIG.queryLimits.listTop}`
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
        console.log(`${DEBUG_PREFIX} Entity list loaded empty`, {
          clientTermGuid,
          rawEntities: data.value || []
        });
        setEntities([]);
        return;
      }

      /* 3️⃣ Collect Entity term GUIDs */
      const entityGuids = new Set<string>();
      const guidToItemId = new Map<string, number>();
      const fallbackLabelByGuid = new Map<string, string>();
      matchedEntities.forEach(e => {
        const titleFallback = String(e.Title || '').trim();
        parseEntityEntries(e.Entity).forEach(entry => {
          entityGuids.add(entry.guid);
          if (!guidToItemId.has(entry.guid)) {
            guidToItemId.set(entry.guid, e.Id);
          }
          if (isReadableName(entry.label) && !fallbackLabelByGuid.has(entry.guid)) {
            fallbackLabelByGuid.set(entry.guid, entry.label);
          } else if (isReadableName(titleFallback) && !fallbackLabelByGuid.has(entry.guid)) {
            fallbackLabelByGuid.set(entry.guid, titleFallback);
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

      const metadataCache = await loadGreenvilleMetadataCache(webUrl);
      const items: EntitySelection[] = [];
      entityGuids.forEach(guid => {
        const mapped = labelMap.get(guid) || '';
        const fallback = fallbackLabelByGuid.get(guid) || '';
        const label = isReadableName(mapped)
          ? mapped
          : isReadableName(fallback)
            ? fallback
            : guid;
        const docCenterTerm = findTermByLabel(metadataCache.docCenterEntities, label);

        items.push({
          id: guidToItemId.get(guid),
          termGuid: guid,
          docCenterTermGuid: docCenterTerm?.id || null,
          label,
          relatedClientGuid: clientTermGuid
        });
      });

      const unique = Array.from(
        new Map(items.map(item => [item.termGuid, item])).values()
      );

      unique.sort((a, b) => a.label.localeCompare(b.label));
      console.log(`${DEBUG_PREFIX} Entity list loaded`, {
        clientTermGuid,
        count: unique.length,
        entities: unique
      });
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
      console.log(`${DEBUG_PREFIX} Entity list skipped, no client term guid`);
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
            onClick={() => {
              console.log(`${DEBUG_PREFIX} Entity clicked`, entity);
              onEntityClick?.(entity);
            }}
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
