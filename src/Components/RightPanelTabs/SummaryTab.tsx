import * as React from 'react';
import styles from './SummaryTab.module.scss';
import {
  TERM_STORE_CONFIG,
  CLIENTS_LIST_COLUMNS,
  DISPLAY_LABELS,
  API_QUERIES,
  type ClientItem
} from '../../Constants';

interface SummaryTabProps {
  webUrl: string;
  clientId: number;
}

const SummaryTab: React.FC<SummaryTabProps> = ({ webUrl, clientId }) => {
  const [item, setItem] = React.useState<any>(null);
  const [clientTerms, setClientTerms] = React.useState<Record<string, string>>({});
  const [entityTerms, setEntityTerms] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    loadSummary();
  }, [clientId]);

  /* ---------------- LOAD LIST ITEM ---------------- */

  const loadSummary = async () => {
    const resp = await fetch(
      `${webUrl}/_api${API_QUERIES.CLIENT_DETAILS(clientId)}`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );

    const data = await resp.json();
    setItem(data);

    const clientGuids = new Set<string>();
    const entityGuids = new Set<string>();

    collectTermGuids(data.RelatedClient, clientGuids);
    collectTermGuids(data.RelatedEntity, entityGuids);

    if (clientGuids.size) {
      await loadTermSet(clientGuids, TERM_STORE_CONFIG.CLIENT_TERM_SET_ID, setClientTerms);
    }
    if (entityGuids.size) {
      await loadTermSet(entityGuids, TERM_STORE_CONFIG.ENTITY_TERM_SET_ID, setEntityTerms);
    }
  };

  /* ---------------- TERM STORE ---------------- */

  const loadTermSet = async (
    guids: Set<string>,
    termSetId: string,
    setState: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    const resp = await fetch(
      `${webUrl}/_api${API_QUERIES.TERM_STORE_TERMS(TERM_STORE_CONFIG.TERM_GROUP_ID, termSetId)}`,
      { headers: { Accept: 'application/json' } }
    );

    const data = await resp.json();

    const map: Record<string, string> = {};
    (data.value || []).forEach((term: any) => {
      if (guids.has(term.id)) {
        const label =
          term.labels?.find((l: any) => l.isDefault)?.name ||
          term.labels?.[0]?.name;
        if (label) map[term.id] = label;
      }
    });

    setState(map);
  };

  /* ---------------- SAFE TAXONOMY ---------------- */

  const collectTermGuids = (value: any, set: Set<string>) => {
    if (!value) return;

    if (typeof value === 'string') {
      value
        .split(';#')
        .filter(v => v.includes('|'))
        .forEach(v => {
          const guid = v.split('|')[1];
          if (guid) set.add(guid);
        });
    } else if (Array.isArray(value)) {
      value.forEach(v => collectTermGuids(v, set));
    } else if (typeof value === 'object' && value.TermGuid) {
      set.add(value.TermGuid);
    }
  };

  const renderClientTaxonomy = (value: any) => {
    const guids = new Set<string>();
    collectTermGuids(value, guids);
    if (!guids.size) return '—';
    return Array.from(guids).map(g => clientTerms[g] || g).join(', ');
  };

  const renderEntityTaxonomy = (value: any) => {
    const guids = new Set<string>();
    collectTermGuids(value, guids);
    if (!guids.size) return '—';
    return Array.from(guids).map(g => entityTerms[g] || g).join(', ');
  };

  /* ---------------- HELPERS ---------------- */

  const renderLookup = (values?: any[]) =>
    values && Array.isArray(values) ? values.map(v => v.Title).join(', ') : '—';

  const renderMultiline = (value?: string) =>
    value
      ? value.split('\n').map((l, i) => (
          <React.Fragment key={i}>
            {l}
            <br />
          </React.Fragment>
        ))
      : '—';

  const renderDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString() : '—';

  if (!item) return <div className={styles.loading}>Loading…</div>;

  /* ---------------- RENDER ---------------- */

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>{DISPLAY_LABELS.CLIENT_NAME}</div>
        <div className={styles.detailValue}>{renderClientTaxonomy(item.Client)}</div>

        <div className={styles.detailLabel}>{DISPLAY_LABELS.FEDERAL_TAX_ID}</div>
        <div className={styles.detailValue}>{item[CLIENTS_LIST_COLUMNS.FEDERAL_TAX_ID] || '—'}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>{DISPLAY_LABELS.BIRTHDAY}</div>
        <div className={styles.detailValue}>{renderDate(item[CLIENTS_LIST_COLUMNS.BIRTHDAY])}</div>

        <div className={styles.detailLabel}>{DISPLAY_LABELS.ANNIVERSARY}</div>
        <div className={styles.detailValue}>{renderDate(item[CLIENTS_LIST_COLUMNS.ANNIVERSARY])}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>{DISPLAY_LABELS.ADDRESS}</div>
        <div className={styles.detailValue}>
          {renderMultiline(item[CLIENTS_LIST_COLUMNS.WORK_ADDRESS])}
        </div>

        <div className={styles.detailLabel}>{DISPLAY_LABELS.ALIASES}</div>
        <div className={styles.detailValue}>{item[CLIENTS_LIST_COLUMNS.ENTITY_ALIASES] || '—'}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>{DISPLAY_LABELS.MARITAL_STATUS}</div>
        <div className={styles.detailValue}>{item[CLIENTS_LIST_COLUMNS.MARITAL_STATUS] || '—'}</div>

        <div className={styles.detailLabel}>{DISPLAY_LABELS.CHILDREN}</div>
        <div className={styles.detailValue}>{renderLookup(item[CLIENTS_LIST_COLUMNS.CHILDREN])}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>{DISPLAY_LABELS.SIBLINGS}</div>
        <div className={styles.detailValue}>{renderLookup(item[CLIENTS_LIST_COLUMNS.SIBLINGS])}</div>

        <div className={styles.detailLabel}>{DISPLAY_LABELS.PARENTS}</div>
        <div className={styles.detailValue}>{renderLookup(item[CLIENTS_LIST_COLUMNS.PARENTS])}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>{DISPLAY_LABELS.SPOUSE}</div>
        <div className={styles.detailValue}>{renderLookup(item[CLIENTS_LIST_COLUMNS.SPOUSE])}</div>

        <div className={styles.detailLabel}>{DISPLAY_LABELS.RELATED_CLIENT}</div>
        <div className={styles.detailValue}>
          {renderClientTaxonomy(item[CLIENTS_LIST_COLUMNS.RELATED_CLIENT])}
        </div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>{DISPLAY_LABELS.RELATED_ENTITY}</div>
        <div className={styles.detailValue}>
          {renderEntityTaxonomy(item[CLIENTS_LIST_COLUMNS.RELATED_ENTITY])}
        </div>

        <div className={styles.detailLabel}>{DISPLAY_LABELS.CREATED}</div>
        <div className={styles.detailValue}>{renderDate(item[CLIENTS_LIST_COLUMNS.CREATED])}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>{DISPLAY_LABELS.MODIFIED_BY}</div>
        <div className={styles.detailValue}>{item[CLIENTS_LIST_COLUMNS.EDITOR]?.Title || '—'}</div>
      </div>
    </div>
  );
};

export default SummaryTab;
