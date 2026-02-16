import * as React from 'react';
import styles from './SummaryTab.module.scss';

const TERM_GROUP_ID = 'cadcb7a6-fcde-4b81-a893-6071c3dd2cbb';
const CLIENT_TERM_SET_ID = 'e15c7ba0-e449-437f-bb70-b35bc582edda';
const ENTITY_TERM_SET_ID = '63f8136b-40cf-4d43-890a-73d4959c5a68';

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
      `${webUrl}/_api/web/lists/getByTitle('Clients')/items(${clientId})?` +
        `$select=*,Children/Title,Siblings/Title,Parents/Title,Spouse0/Title&` +
        `$expand=Children,Siblings,Parents,Spouse0`,
      { headers: { Accept: 'application/json;odata=nometadata' } }
    );

    const data = await resp.json();
    setItem(data);

    const clientGuids = new Set<string>();
    const entityGuids = new Set<string>();

    collectTermGuids(data.Client, clientGuids);
    collectTermGuids(data.RelatedClient, clientGuids);
    collectTermGuids(data.RelatedEntity, entityGuids);

    if (clientGuids.size) {
      await loadTermSet(clientGuids, CLIENT_TERM_SET_ID, setClientTerms);
    }
    if (entityGuids.size) {
      await loadTermSet(entityGuids, ENTITY_TERM_SET_ID, setEntityTerms);
    }
  };

  /* ---------------- TERM STORE ---------------- */

  const loadTermSet = async (
    guids: Set<string>,
    termSetId: string,
    setState: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    const resp = await fetch(
      `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${termSetId}')/terms`,
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
    values?.map(v => v.Title).join(', ') || '—';

  const renderMultiline = (value?: string) =>
    value
      ? value.split('\n').map((l, i) => (
          <React.Fragment key={i}>
            {l}
            <br />
          </React.Fragment>
        ))
      : '—';

  if (!item) return <div className={styles.loading}>Loading…</div>;

  /* ---------------- RENDER ---------------- */

  return (
    <div className={styles.detailCard}>
      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Client Name</div>
        <div className={styles.detailValue}>{renderClientTaxonomy(item.Client)}</div>

        <div className={styles.detailLabel}>Aliases</div>
        <div className={styles.detailValue}>{item.EntityAliases || '—'}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Address</div>
        <div className={styles.detailValue}>
          {renderMultiline(item.WorkAddress)}
        </div>

        <div className={styles.detailLabel}>Marital Status</div>
        <div className={styles.detailValue}>{item.MaritalStatus || '—'}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Children</div>
        <div className={styles.detailValue}>{renderLookup(item.Children)}</div>

        <div className={styles.detailLabel}>Siblings</div>
        <div className={styles.detailValue}>{renderLookup(item.Siblings)}</div>
      </div>

      <div className={styles.detailRow}>
        <div className={styles.detailLabel}>Related Client</div>
        <div className={styles.detailValue}>
          {renderClientTaxonomy(item.RelatedClient)}
        </div>

        <div className={styles.detailLabel}>Related Entity</div>
        <div className={styles.detailValue}>
          {renderEntityTaxonomy(item.RelatedEntity)}
        </div>
      </div>
    </div>
  );
};

export default SummaryTab;
