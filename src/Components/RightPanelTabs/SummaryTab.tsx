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
  const [clientTerms, setClientTerms] = React.useState<Record<string, string>>(
    {}
  );
  const [entityTerms, setEntityTerms] = React.useState<Record<string, string>>(
    {}
  );

  React.useEffect(() => {
    loadSummary();
  }, [clientId]);

  /* ================= LOAD CLIENT ================= */

  const loadSummary = async () => {
    const resp = await fetch(
      `${webUrl}/_api/web/lists/getByTitle('Clients')/items(${clientId})?` +
        `$select=*,Children/Id,Children/Title,Siblings/Id,Siblings/Title,Parents/Id,Parents/Title&` +
        `$expand=Children,Siblings,Parents`,
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

  /* ================= TERM STORE ================= */

  const loadTermSet = async (
    guids: Set<string>,
    setId: string,
    setState: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    const resp = await fetch(
      `${webUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${setId}')/terms`,
      { headers: { Accept: 'application/json' } }
    );

    const data = await resp.json();
    const map: Record<string, string> = {};

    (data.value || []).forEach((t: any) => {
      if (guids.has(t.id)) {
        const label =
          t.labels?.find((l: any) => l.isDefault)?.name ||
          t.labels?.[0]?.name;
        if (label) map[t.id] = label;
      }
    });

    setState(map);
  };

  /* ================= TAXONOMY HELPERS ================= */

  const collectTermGuids = (val: any, set: Set<string>) => {
    if (!val) return;

    if (typeof val === 'string') {
      val
        .split(';#')
        .filter(v => v.includes('|'))
        .forEach(v => set.add(v.split('|')[1]));
    } else if (Array.isArray(val)) {
      val.forEach(v => collectTermGuids(v, set));
    } else if (val.TermGuid) {
      set.add(val.TermGuid);
    }
  };

  const renderClientTaxonomy = (val: any) =>
    renderTaxonomy(val, clientTerms);

  const renderEntityTaxonomy = (val: any) =>
    renderTaxonomy(val, entityTerms);

  const getClientTaxonomyLabels = (val: any) =>
    getTaxonomyLabels(val, clientTerms);

  const getEntityTaxonomyLabels = (val: any) =>
    getTaxonomyLabels(val, entityTerms);

  const renderTaxonomy = (
    val: any,
    map: Record<string, string>
  ): string => {
    return getTaxonomyLabels(val, map).join(', ');
  };

  const getTaxonomyLabels = (
    val: any,
    map: Record<string, string>
  ): string[] => {
    const guids = new Set<string>();
    collectTermGuids(val, guids);
    if (!guids.size) return [];
    return Array.from(guids)
      .map(g => map[g] || g)
      .filter(Boolean);
  };

  const renderBulletList = (items: string[]) =>
    items.length ? (
      <ul className={styles.list}>
        {items.map((itemText, i) => (
          <li key={i}>{itemText}</li>
        ))}
      </ul>
    ) : null;

  /* ================= UI HELPERS ================= */

  const renderMultiline = (v?: string) =>
    v ? (
      v.split('\n').map((l, i) => (
        <React.Fragment key={i}>
          {l}
          <br />
        </React.Fragment>
      ))
    ) : null;

  const getListLabels = (value: any): string[] => {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map(v => v?.Title || v?.LookupValue || v?.Label || v?.label)
        .filter(Boolean);
    }

    if (typeof value === 'object') {
      if (Array.isArray(value.results)) {
        return value.results
          .map((v: any) => v?.Title || v?.LookupValue || v?.Label || v?.label)
          .filter(Boolean);
      }
      const single = value.Title || value.LookupValue || value.Label || value.label;
      return single ? [single] : [];
    }

    if (typeof value === 'string') {
      const taxonomyLabels = value
        .split(';#')
        .filter(v => v.includes('|'))
        .map(v => v.split('|')[0])
        .filter(Boolean);
      if (taxonomyLabels.length) return taxonomyLabels;
      return [value];
    }

    return [];
  };

  const renderList = (value: any) => {
    const labels = getListLabels(value);
    return labels.length ? (
      <ul className={styles.list}>
        {labels.map((label, i) => (
          <li key={i}>{label}</li>
        ))}
      </ul>
    ) : null;
  };

  const hasValue = (v: any) =>
    v !== null && v !== undefined && v !== '';

  if (!item) {
    return <div className={styles.loading}>Loading summary…</div>;
  }

  /* ================= SECTIONS ================= */

  const coreFields = [
    { label: 'Client Name', value: renderClientTaxonomy(item.Client) },
    { label: 'Aliases', value: item.EntityAliases },
    { label: 'Address', value: renderMultiline(item.WorkAddress) },
    { label: 'Marital Status', value: item.MaritalStatus },
    { label: 'Generation', value: item.Generation },
    { label: 'Birthday', value: item.Birthday },
    { label: 'Federal Tax ID', value: item.FederalTaxID },
    { label: 'Drivers License', value: item.DriversLicense },
    { label: 'P.O. Box', value: item.POBox },
    { label: 'DL State Of Issue', value: item.DLStateOfIssue },
    { label: 'DL Expire', value: item.DLExpire }
  ].filter(f => hasValue(f.value));

  const familySection =
    getListLabels(item.Parents).length > 0 ||
    getListLabels(item.Siblings).length > 0 ||
    getListLabels(item.Children).length > 0 ||
    hasValue(item.MinorChild);

  const relationshipSection =
    item.RelatedClient || item.RelatedEntity;

  /* ================= RENDER ================= */

return (
  <div className={styles.summaryRoot}>
    {/* SECTION 1: CORE DETAILS */}
    <div className={styles.section}>
      {chunk(coreFields, 3).map((row, i) => (
        <div className={styles.rowWrapper}>
          <div className={styles.row} key={i}>
            {row.map(f => (
              <div className={styles.cell} key={f.label}>
                <span className={styles.label}>{f.label}</span>
                <div className={styles.value}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>

    {/* SECTION 2: FAMILY */}
    {familySection && (
      <>
        <div className={styles.separator} />
        <div className={styles.section}>
          <div className={styles.rowWrapper}>
            <div className={styles.row}>
              {getListLabels(item.Parents).length > 0 && (
                <div className={styles.cell}>
                  <span className={styles.label}>Parents</span>
                  {renderList(item.Parents)}
                </div>
              )}

              {getListLabels(item.Siblings).length > 0 && (
                <div className={styles.cell}>
                  <span className={styles.label}>Siblings</span>
                  {renderList(item.Siblings)}
                </div>
              )}

              {getListLabels(item.Children).length > 0 && (
                <div className={styles.cell}>
                  <span className={styles.label}>Children</span>
                  {renderList(item.Children)}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}

    {/* SECTION 3: RELATIONSHIPS */}
    {relationshipSection && (
      <>
        <div className={styles.separator} />
        <div className={styles.section}>
          <div className={styles.rowWrapper}>
            <div className={styles.row}>
              {item.RelatedClient && (
                <div className={styles.cell}>
                  <span className={styles.label}>Related Clients</span>
                  {renderBulletList(getClientTaxonomyLabels(item.RelatedClient))}
                </div>
              )}

              {item.RelatedEntity && (
                <div className={styles.cell}>
                  <span className={styles.label}>Related Entities</span>
                  {renderBulletList(getEntityTaxonomyLabels(item.RelatedEntity))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    )}
  </div>
);

};

/* ================= UTIL ================= */

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );


export default SummaryTab;
