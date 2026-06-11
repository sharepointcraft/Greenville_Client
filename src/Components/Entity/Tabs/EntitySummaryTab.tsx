import * as React from 'react';
import styles from '../../Clients/RightPanelTabs/SummaryTab.module.scss';
import type { EntitySelection } from '../../Clients/RightPanelTabs/EntitiesTab';

interface EntitySummaryTabProps {
  webUrl: string;
  entity: EntitySelection | null;
}

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );

const EntitySummaryTab: React.FC<EntitySummaryTabProps> = ({ webUrl, entity }) => {
  /* ========= LOCAL STATIC CONFIG ========= */
  //const PROD_HOME = 'https://greenvilleptrs.sharepoint.com/sites/Prod-Home';
  const PROD_HOME = 'https://greenvilleptrs.sharepoint.com';
  const TERM_GROUP_ID = '35fa5400-bc14-40e7-97f0-71b8ab5d5409';
  const TERM_SET_CLIENTS = 'c303ee9c-f01a-40d9-8ef8-18778e0ecc13';
  const TERM_SET_ENTITIES = '29b96c62-c253-46e1-8d72-41b0d2ab86ec';
  const TERM_SET_BANKS = '6be8631f-bec1-46ba-b4cf-2e3704aeafbb';

  const ENTITIES_LIST_TITLE = 'Entities';
  const BANK_COLUMN = 'Bank1';
  const RELATED_CLIENT_COLUMN = 'RelatedClient';
  const RELATED_ENTITY_COLUMN = 'RelatedEntity';

  const PATTERNS = {
    guid: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    guidExact: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  };

  const resolveApiWebUrl = (url: string): string => {
    const configured = PROD_HOME.replace(/\/+$/, '');
    if (!url) return configured;
    try {
      const current = new URL(url);
      const target = new URL(configured);
      if (current.host.toLowerCase() !== target.host.toLowerCase()) {
        return configured;
      }
    } catch {
      return configured;
    }
    return configured;
  };

  const buildListItemsApiUrlLocal = (url: string, listTitle: string): string =>
    `${resolveApiWebUrl(url)}/_api/web/lists/getByTitle('${listTitle}')/items`;

  const buildTermSetTermsApiUrlLocal = (url: string, termSetId: string): string =>
    `${resolveApiWebUrl(url)}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${termSetId}')/terms`;

  const getODataNextLink = (payload: any): string | undefined => {
    if (!payload || typeof payload !== 'object') return undefined;
    return (
      payload['@odata.nextLink'] ||
      payload['@odata.nextlink'] ||
      payload['odata.nextLink'] ||
      payload['odata.nextlink']
    );
  };

  const extractTermLabelFromPayload = (payload: any): string | undefined => {
    if (!payload) return undefined;
    const getDefaultLabel = (term: any): string | undefined =>
      term?.labels?.find((l: any) => l?.isDefault)?.name || term?.labels?.[0]?.name;
    if (payload.id) return getDefaultLabel(payload);
    if (Array.isArray(payload.value) && payload.value.length) return getDefaultLabel(payload.value[0]);
    return undefined;
  };

  const fetchTermLabelByGuid = async (
    url: string,
    termSetId: string,
    guid: string
  ): Promise<string | undefined> => {
    const apiWebUrl = resolveApiWebUrl(url);
    const endpoints = [
      `${apiWebUrl}/_api/v2.1/termstore/groups('${TERM_GROUP_ID}')/sets('${termSetId}')/terms('${guid}')`,
      `${apiWebUrl}/_api/v2.1/termstore/sets('${termSetId}')/terms('${guid}')`
    ];
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
        if (!response.ok) continue;
        const payload = await response.json();
        const label = extractTermLabelFromPayload(payload);
        if (label) return label;
      } catch { /* try next */ }
    }
    return undefined;
  };

  const fetchTermLabelMapLocal = async (
    url: string,
    termSetId: string,
    targetGuids?: Set<string>
  ): Promise<Record<string, string>> => {
    const wanted = targetGuids ? new Set(Array.from(targetGuids).map(g => g.toLowerCase())) : undefined;
    const labels: Record<string, string> = {};
    const visited = new Set<string>();
    let next: string | undefined = buildTermSetTermsApiUrlLocal(url, termSetId);

    while (next && !visited.has(next)) {
      visited.add(next);
      const resp = await fetch(next, { headers: { Accept: 'application/json' } });
      if (!resp.ok) {
        const detail = await resp.text();
        throw new Error(`Term set request failed (${resp.status}): ${detail || resp.statusText}`);
      }
      const payload = await resp.json();
      const terms = Array.isArray(payload?.value) ? payload.value : [];
      terms.forEach((term: any) => {
        const id = String(term?.id || '').toLowerCase();
        if (!id) return;
        if (wanted && !wanted.has(id)) return;
        const label = term?.labels?.find((l: any) => l?.isDefault)?.name || term?.labels?.[0]?.name;
        if (label) labels[id] = String(label);
      });
      if (wanted && Object.keys(labels).length >= wanted.size) break;
      next = getODataNextLink(payload);
    }

    if (wanted && wanted.size) {
      const unresolved = Array.from(wanted).filter(g => !labels[g]);
      if (unresolved.length) {
        await Promise.all(
          unresolved.map(async guid => {
            const label = await fetchTermLabelByGuid(url, termSetId, guid);
            if (label) labels[guid] = String(label);
          })
        );
      }
    }
    return labels;
  };

  const [item, setItem] = React.useState<any>(null);
  const [clientTerms, setClientTerms] = React.useState<Record<string, string>>({});
  const [entityTerms, setEntityTerms] = React.useState<Record<string, string>>({});
  const [bankTerms, setBankTerms] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  /* ================= TAXONOMY & DATA HELPERS ================= */

  const parseTaxonomyEntries = (value: any): Array<{ guid: string; label: string }> => {
    if (!value) return [];
    if (typeof value === 'string') {
      const entries: Array<{ guid: string; label: string }> = [];
      value
        .split(';#')
        .map(token => token.trim())
        .filter(Boolean)
        .forEach(token => {
          if (token.indexOf('|') !== -1) {
            const parts = token.split('|');
            const label = String(parts[0] || '').trim();
            const guid = String(parts[1] || '').trim().toLowerCase();
            if (PATTERNS.guidExact.test(guid)) {
              entries.push({ guid, label });
            }
            return;
          }
          const guid = token.toLowerCase();
          if (PATTERNS.guidExact.test(guid)) {
            entries.push({ guid, label: '' });
          }
        });
      return entries;
    }
    if (Array.isArray(value)) {
      const nested: Array<{ guid: string; label: string }> = [];
      value.forEach(v => {
        nested.push(...parseTaxonomyEntries(v));
      });
      return nested;
    }
    if (typeof value === 'object') {
      const guid = String(value.TermGuid || value.termGuid || value.Id || value.id || '').trim().toLowerCase();
      const label = String(value.Label || value.label || value.name || '').trim();
      if (PATTERNS.guidExact.test(guid)) {
        return [{ guid, label }];
      }
    }
    return [];
  };

  const isReadableTaxonomyLabel = (value: string): boolean => {
    const text = String(value || '').trim();
    if (!text) return false;
    if (PATTERNS.guidExact.test(text)) return false;
    if (/^\d+$/.test(text)) return false; 
    if (text.toLowerCase().includes('error;#')) return false; 
    return true;
  };

  const collectTermGuids = (value: any, set: Set<string>) => {
    parseTaxonomyEntries(value).forEach(entry => {
      if (entry.guid) {
        set.add(entry.guid);
      }
    });
  };

  const getTaxonomyLabels = (value: any, map: Record<string, string>, fallback?: any): string[] => {
    const seen = new Set<string>();
    const resolved: string[] = [];

    const entries = [
      ...parseTaxonomyEntries(value),
      ...parseTaxonomyEntries(fallback)
    ];

    entries.forEach(entry => {
      const mapped = entry.guid ? map[entry.guid] : '';
      const fallbackText = isReadableTaxonomyLabel(entry.label) ? entry.label : '';
      
      const valueToShow = mapped || fallbackText;
      if (!valueToShow) return;

      const key = valueToShow.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      resolved.push(valueToShow);
    });

    return resolved;
  };

  const renderTaxonomy = (value: any, map: Record<string, string>, fallback?: any): string =>
    getTaxonomyLabels(value, map, fallback).join(', ');

  const formatScalar = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (!text) return '—';
      if (PATTERNS.guidExact.test(text)) return '—'; 
      if (/^\d+$/.test(text) && text.length < 5) return '—'; 
      if (text.toLowerCase().includes('error;#')) return '—'; 
      return text;
    }
    if (Array.isArray(value)) {
      const parts = value.map(v => formatScalar(v)).filter(Boolean).filter(v => v !== '—');
      return parts.length ? parts.join(', ') : '—';
    }
    if (typeof value === 'object') {
      const label = (value as any).Label || (value as any).Title || (value as any).TermGuid || (value as any).name;
      if (label && !PATTERNS.guidExact.test(String(label))) return String(label);
    }
    return '—';
  };

  const stripHtml = (value: any): string => {
    const text = formatScalar(value);
    if (!text || text === '—') return '—';
    const tmp = document.createElement('div');
    tmp.innerHTML = text;
    const clean = tmp.textContent || tmp.innerText || '';
    return clean.trim() || '—';
  };

  const formatDate = (value?: string | number | Date) => {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '—';
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const day = d.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' });
    const year = d.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' });
    return `${month}-${day}-${year}`;
  };

  const getPeopleLabels = (value: any): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map(v => stripHtml(v?.Title || v?.name || v?.Label || v?.Email || v?.EMail))
        .filter(label => label && label !== '—');
    }
    if (typeof value === 'object') {
      const name = value.Title || value.name || value.Label || value.Email || value.EMail;
      const label = stripHtml(name);
      return label && label !== '—' ? [label] : [];
    }
    if (typeof value === 'string') {
      const label = stripHtml(value);
      return label && label !== '—' ? [label] : [];
    }
    return [];
  };

  const renderBulletList = (items: string[]) =>
    items.length ? (
      <ul className={styles.list}>
        {items.map((itemText, i) => (
          <li key={i}>{itemText}</li>
        ))}
      </ul>
    ) : null;

  const hasValue = (v: any) => {
    if (v === null || v === undefined || v === '' || v === '—') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  };

  /* ================= TERM STORE DATA LOADER ================= */

  const loadTermSetData = async (guids: Set<string>, setId: string) => {
    if (!guids.size) return {};
    try {
      return await fetchTermLabelMapLocal(webUrl, setId, guids);
    } catch {
      return {};
    }
  };

  /* ================= LOAD SUMMARY ================= */

  const loadSummary = async () => {
    if (!entity?.id) {
      setItem(null);
      setError(null);
      setClientTerms({});
      setEntityTerms({});
      setBankTerms({});
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setItem(null); 

      const fetchJson = async (url: string) => {
        const resp = await fetch(url, { headers: { Accept: 'application/json;odata=nometadata' } });
        if (!resp.ok) {
          const detail = await resp.text();
          throw new Error(`HTTP ${resp.status}: ${detail || 'Request failed'}`);
        }
        return resp.json();
      };

      const minimalSummarySelect =
        'Id,Title,AccountNo,AgreementDated,Bank1,Beneficiary/Title,Corporate_x0020_Trustee/Title,Created,EntityIncorporationFormationDate,EntityDissolved,DistributionAdvisor,Entity,EntityDesc,EntityID,EntityShortName,EntityStatus,EntityType,FederalTaxID,Grantor,InvestmentAdvisor,InvestmentManager,LastAnnualMeetingDate,EntityAliases,ManagedBy,Manager/Title,ManagerLimits,Members/Title,Modified,Notes,Ownership,Parent/Title,PowerOfApptmt,PurposeClassification,WorkAddress,RegisteredAgent/Title,RegisteredMailingAddress,RelatedClient,RelatedEntity,RoutingNo,Settler/Title,StateIDNumber,EntityJurisdiction,SuccessorTrustee,Support,TaxPreparer,TrustSubType,TrustType,Trustee/Title,TrusteeRemoverCommittee,Author/Title,Editor/Title';

      const minimalSummaryExpand = 'Beneficiary,Corporate_x0020_Trustee,Manager,Members,Parent,RegisteredAgent,Settler,Trustee,Author,Editor';

      const selectCandidates = Array.from(
        new Set([
          minimalSummarySelect,
          '*'
        ])
      );

      const expandCandidates = Array.from(
        new Set([minimalSummaryExpand, ''])
      );

      let data: any = null;
      let lastSummaryError: Error | null = null;

      for (const select of selectCandidates) {
        const hasProjectedFields = select.indexOf('/') !== -1;
        const candidateExpandList = hasProjectedFields
          ? expandCandidates
          : ['', minimalSummaryExpand];

        for (const expand of candidateExpandList) {
          try {
            const expandPart = expand ? `&$expand=${expand}` : '';
            data = await fetchJson(
              `${buildListItemsApiUrlLocal(webUrl, ENTITIES_LIST_TITLE)}(${entity.id})?` +
                `$select=${select}${expandPart}`
            );
            lastSummaryError = null;
            break;
          } catch (error) {
            lastSummaryError = error instanceof Error ? error : new Error(String(error));
          }
        }
        if (!lastSummaryError) break;
      }

      if (!data && lastSummaryError) throw lastSummaryError;

      // 🟢 THE FIX: Safely retrieve and apply Taxonomy Names without mutating 'data' concurrently 🟢
      const fetchTermFromHiddenList = async (wssId: number): Promise<string | null> => {
        try {
          const res = await fetch(
            `${resolveApiWebUrl(webUrl)}/_api/web/lists/getByTitle('TaxonomyHiddenList')/items(${wssId})?$select=Term`,
            { headers: { Accept: 'application/json;odata=nometadata' } }
          );
          if (res.ok) {
            const json = await res.json();
            return json.Term || null;
          }
        } catch { /* ignore */ }
        return null;
      };

      const fetchTranslatedTerm = async (val: any): Promise<string | null> => {
        if (val === undefined || val === null) return null;
        
        if (typeof val === 'number' || (typeof val === 'string' && /^\d+$/.test(val))) {
          return await fetchTermFromHiddenList(Number(val));
        }
        
        if (Array.isArray(val) && val.every(v => typeof v === 'number' || /^\d+$/.test(v))) {
          const terms = await Promise.all(val.map(v => fetchTermFromHiddenList(Number(v))));
          return terms.filter(Boolean).join(', ') || null;
        }

        return null;
      };

      // 1. Fetch all translations securely in parallel
      const [bankVal, relClientVal, relEntityVal, entityVal] = await Promise.all([
        fetchTranslatedTerm(data[BANK_COLUMN]),
        fetchTranslatedTerm(data[RELATED_CLIENT_COLUMN]),
        fetchTranslatedTerm(data[RELATED_ENTITY_COLUMN]),
        fetchTranslatedTerm(data.Entity)
      ]);

      // 2. Synchronously update the data object (Keeps ESLint perfectly happy!)
      if (bankVal) data[BANK_COLUMN] = bankVal;
      if (relClientVal) data[RELATED_CLIENT_COLUMN] = relClientVal;
      if (relEntityVal) data[RELATED_ENTITY_COLUMN] = relEntityVal;
      if (entityVal) data.Entity = entityVal;
      // 🟢 END OF FIX 🟢

      const clientGuids = new Set<string>();
      const entityGuids = new Set<string>();
      const bankGuids = new Set<string>(); 

      collectTermGuids(data[RELATED_CLIENT_COLUMN], clientGuids);
      collectTermGuids(data.Entity, entityGuids);
      collectTermGuids(data[RELATED_ENTITY_COLUMN], entityGuids);
      collectTermGuids(data[BANK_COLUMN], bankGuids); 

      const [clientMap, entityMap, bankMap] = await Promise.all([
        loadTermSetData(clientGuids, TERM_SET_CLIENTS),
        loadTermSetData(entityGuids, TERM_SET_ENTITIES),
        loadTermSetData(bankGuids, TERM_SET_BANKS)
      ]);

      const allMissingGuids = new Set<string>();
      clientGuids.forEach(g => { if (!clientMap[g]) allMissingGuids.add(g); });
      entityGuids.forEach(g => { if (!entityMap[g]) allMissingGuids.add(g); });
      bankGuids.forEach(g => { if (!bankMap[g]) allMissingGuids.add(g); });

      if (allMissingGuids.size > 0) {
        const fetchGlobalTermLabel = async (guid: string): Promise<string | null> => {
          try {
            const resp = await fetch(`${webUrl}/_api/v2.1/termstore/terms('${guid}')`, {
              headers: { Accept: 'application/json' }
            });
            if (resp.ok) {
              const termData = await resp.json();
              return termData?.labels?.find((l: any) => l.isDefault)?.name || termData?.labels?.[0]?.name || termData?.name || null;
            }
          } catch { /* ignore */ }
          return null;
        };

        await Promise.all(
          Array.from(allMissingGuids).map(async guid => {
            const label = await fetchGlobalTermLabel(guid);
            if (label) {
              if (clientGuids.has(guid)) clientMap[guid] = label;
              if (entityGuids.has(guid)) entityMap[guid] = label;
              if (bankGuids.has(guid)) bankMap[guid] = label;
            }
          })
        );
      }

      setClientTerms(clientMap);
      setEntityTerms(entityMap);
      setBankTerms(bankMap);
      setItem(data);

    } catch (err) {
      console.error('Entity summary load error', err);
      setError(
        err instanceof Error
          ? `Failed to load entity summary: ${err.message}`
          : 'Failed to load entity summary'
      );
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadSummary();
  }, [entity?.id, webUrl]);

  if (loading) return <div className={styles.loading}>Loading entity summary…</div>;
  if (error) return <div className={styles.loading}>{error}</div>;
  if (!item) return <div className={styles.loading}>No entity details found</div>;

  /* ================= SECTIONS DATA ================= */

  const prettifyKey = (key: string) => {
    const map: Record<string, string> = {
      AccountNo: 'Account Number',
      AgreementDated: 'Agreement Dated',
      [BANK_COLUMN]: 'Bank',
      [RELATED_CLIENT_COLUMN]: 'Related Client',
      [RELATED_ENTITY_COLUMN]: 'Related Entity',
      Beneficiary: 'Beneficiary',
      Corporate_x0020_Trustee: 'Corporate Trustee',
      EntityIncorporationFormationDate: 'Date of Formation',
      EntityDissolved: 'Dissolved',
      DistributionAdvisor: 'Distribution Advisor',
      Entity: 'Entity',
      EntityDesc: 'Entity Description',
      EntityID: 'Entity ID',
      EntityShortName: 'Entity Short Name',
      EntityStatus: 'Entity Status',
      EntityType: 'Entity Type',
      FederalTaxID: 'Federal Tax ID / SSN',
      Grantor: 'Grantor',
      InvestmentAdvisor: 'Investment Advisor',
      InvestmentManager: 'Investment Manager',
      LastAnnualMeetingDate: 'Last Annual Meeting Date',
      EntityAliases: 'Legal Name',
      ManagedBy: 'Managed By',
      Manager: 'Manager',
      ManagerLimits: 'Manager Limits',
      Members: 'Member(s)',
      Ownership: 'Ownership',
      Parent: 'Parent',
      PowerOfApptmt: 'Power of Appointment',
      PurposeClassification: 'Purpose Classification',
      WorkAddress: 'Registered Address',
      RegisteredAgent: 'Registered Agent',
      RegisteredMailingAddress: 'Registered Mailing Address',
      RoutingNo: 'Routing Number',
      Settler: 'Settler',
      StateIDNumber: 'State ID',
      EntityJurisdiction: 'State of Jurisdiction',
      SuccessorTrustee: 'Successor Trustee',
      Support: 'Support',
      TaxPreparer: 'Tax Preparer',
      Title: 'Title',
      TrustSubType: 'Trust Sub-Type',
      TrustType: 'Trust Type',
      Trustee: 'Trustee',
      TrusteeRemoverCommittee: 'Trustee Remover Committee',
      Author: 'Created By',
      Editor: 'Modified By'
    };

    if (map[key]) return map[key];

    return key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, ch => ch.toUpperCase())
      .trim();
  };

  const knownTaxonomy = (key: string, value: any): string | null => {
    const fallback = item?.[`${key}TaxHTField0`];
    if (key === RELATED_CLIENT_COLUMN) return renderTaxonomy(value, clientTerms, fallback) || null;
    if (key === RELATED_ENTITY_COLUMN || key === 'Entity') return renderTaxonomy(value, entityTerms, fallback) || null;
    if (key === BANK_COLUMN) {
      const mergedMap = { ...bankTerms, ...clientTerms, ...entityTerms };
      return renderTaxonomy(value, mergedMap, fallback) || null;
    }
    return null;
  };

  const excludedKeys = new Set([
    'Id', 'ID', 'GUID', 'odata.etag', 'FileSystemObjectType', 'Attachments',
    'AuthorId', 'EditorId', 'Created', 'Modified', 'ContentTypeId',
    'ManagerId', 'MembersId', 'SettlerId', 'TrusteeId', 'BeneficiaryId',
    'Corporate_x0020_TrusteeId', 'RegisteredAgentId', 'ParentId', 
    'OData__UIVersionString', 'OData__ColorTag', 'ComplianceAssetId',
    'EntityMMDName', 'EntityMMDSeparator', 'EntityMMDNameCalc', 'Title', 'Entity', 'Bank1'
  ]);

  const peopleKeys = new Set([
    'Members', 'Manager', 'Settler', 'Trustee', 'Beneficiary', 'Corporate_x0020_Trustee', 
    'RegisteredAgent', 'Parent', 'Grantor', 'SuccessorTrustee', 'TrusteeRemoverCommittee',
    'Author', 'Editor'
  ]);
  const relationshipKeys = new Set([RELATED_CLIENT_COLUMN, RELATED_ENTITY_COLUMN]);
  const bankKeys = new Set([BANK_COLUMN, 'AccountNo', 'RoutingNo', 'FederalTaxID', 'TaxPreparer', 'InvestmentAdvisor', 'InvestmentManager', 'DistributionAdvisor']);

  const processField = (key: string) => {
    const value = item[key];
    const taxValue = knownTaxonomy(key, value);
    const rawValue = taxValue ?? value;
    
    if (key.includes('Date') || key === 'Created' || key === 'Modified' || key === 'AgreementDated' || key === 'EntityDissolved') {
       return { label: prettifyKey(key), value: formatDate(rawValue) };
    }

    const display =
      key.toLowerCase().includes('desc') || key.toLowerCase().includes('notes') || key === 'WorkAddress' || key === 'RegisteredMailingAddress' || key === 'Support' || key === 'ManagerLimits'
        ? stripHtml(rawValue)
        : formatScalar(rawValue);
    return { label: prettifyKey(key), value: display };
  };

  const allKeys = Object.keys(item || {}).filter(k => !excludedKeys.has(k) && k !== 'FieldValuesAsText');

  const generalKeys = allKeys.filter(
    k => !peopleKeys.has(k) && !relationshipKeys.has(k) && !bankKeys.has(k)
  );
  const generalOrder = ['Entity', 'EntityAliases', 'EntityShortName', 'EntityID', 'EntityStatus', 'EntityType'];
  generalKeys.sort((a, b) => {
    const idxA = generalOrder.indexOf(a);
    const idxB = generalOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return prettifyKey(a).localeCompare(prettifyKey(b));
  });
  const generalFields = generalKeys.map(processField).filter(f => hasValue(f.value));

  const relKeys = allKeys.filter(k => relationshipKeys.has(k));
  const relationshipFields = relKeys.map(processField).filter(f => hasValue(f.value));

  const bnkKeys = allKeys.filter(k => bankKeys.has(k));
  const bankOrder = [BANK_COLUMN, 'AccountNo', 'RoutingNo', 'FederalTaxID', 'TaxPreparer'];
  bnkKeys.sort((a, b) => {
    const idxA = bankOrder.indexOf(a);
    const idxB = bankOrder.indexOf(b);
    return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
  });
  const bankFields = bnkKeys.map(processField).filter(f => hasValue(f.value));

  const peopleSection = Array.from(peopleKeys).some(k => getPeopleLabels(item[k]).length > 0);

  /* ================= RENDER ================= */

  return (
    <div className={styles.summaryRoot}>
      
      {generalFields.length > 0 && (
        <div className={styles.section}>
          {chunk(generalFields, 3).map((row, i) => (
            <div className={styles.rowWrapper} key={`gen-${i}`}>
              <div className={styles.row}>
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
      )}

      {relationshipFields.length > 0 && (
        <>
          <div className={styles.separator} />
          <div className={styles.section}>
            <div className={styles.rowWrapper}>
              <div className={styles.row}>
                {relationshipFields.map(f => (
                  <div className={styles.cell} key={f.label}>
                    <span className={styles.label}>{f.label}</span>
                    <div className={styles.value}>{f.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {bankFields.length > 0 && (
        <>
          <div className={styles.separator} />
          <div className={styles.section}>
            {chunk(bankFields, 3).map((row, i) => (
              <div className={styles.rowWrapper} key={`bank-${i}`}>
                <div className={styles.row}>
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
        </>
      )}

      {peopleSection && (
        <>
          <div className={styles.separator} />
          <div className={styles.section}>
            <div className={styles.rowWrapper}>
              <div className={styles.row}>
                
                {Array.from(peopleKeys).map(k => {
                  const labels = getPeopleLabels(item[k]);
                  if (labels.length === 0) return null;
                  return (
                    <div className={styles.cell} key={k}>
                      <span className={styles.label}>{prettifyKey(k)}</span>
                      {renderBulletList(labels)}
                    </div>
                  );
                })}

              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default EntitySummaryTab;
