import { TENANT_CONFIG } from '../config/tenantConfig';
import { fetchTaxonomyTerms, type ITaxonomyTerm } from './taxonomyService';

export interface ISiteColumnInfo {
  id: string;
  internalName: string;
  title: string;
  typeAsString: string;
  hidden: boolean;
  readOnlyField: boolean;
}

export interface IGreenvilleMetadataCache {
  rootSiteColumns: ISiteColumnInfo[];
  docCenterColumns: ISiteColumnInfo[];
  rootSiteClients: ITaxonomyTerm[];
  rootSiteEntities: ITaxonomyTerm[];
  rootSiteBanks: ITaxonomyTerm[];
  docCenterClients: ITaxonomyTerm[];
  docCenterEntities: ITaxonomyTerm[];
  docCenterBanks: ITaxonomyTerm[];
}

export const RootSiteColumns: ISiteColumnInfo[] = [];
export const DocCenterColumns: ISiteColumnInfo[] = [];
export const RootSiteClients: ITaxonomyTerm[] = [];
export const RootSiteEntities: ITaxonomyTerm[] = [];
export const RootSiteBanks: ITaxonomyTerm[] = [];
export const DocCenterClients: ITaxonomyTerm[] = [];
export const DocCenterEntities: ITaxonomyTerm[] = [];
export const DocCenterBanks: ITaxonomyTerm[] = [];

let cachePromise: Promise<IGreenvilleMetadataCache> | null = null;

const replaceArrayContents = <T>(target: T[], values: T[]): T[] => {
  target.splice(0, target.length, ...values);
  return target;
};

const mapColumn = (field: any): ISiteColumnInfo => ({
  id: String(field?.Id || field?.id || ''),
  internalName: String(field?.InternalName || ''),
  title: String(field?.Title || ''),
  typeAsString: String(field?.TypeAsString || ''),
  hidden: Boolean(field?.Hidden),
  readOnlyField: Boolean(field?.ReadOnlyField)
});

const fetchColumns = async (siteUrl: string): Promise<ISiteColumnInfo[]> => {
  const response = await fetch(
    `${siteUrl.replace(/\/+$/, '')}/_api/web/fields?$select=Id,InternalName,Title,TypeAsString,Hidden,ReadOnlyField`,
    { headers: { Accept: 'application/json;odata=nometadata' } }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Column metadata request failed (${response.status}): ${detail || response.statusText}`);
  }

  const payload = await response.json();
  return (Array.isArray(payload?.value) ? payload.value : [])
    .map(mapColumn)
    .filter((field: ISiteColumnInfo) => field.internalName)
    .sort((a: ISiteColumnInfo, b: ISiteColumnInfo) => a.title.localeCompare(b.title));
};

export const loadGreenvilleMetadataCache = async (webUrl: string): Promise<IGreenvilleMetadataCache> => {
  if (!cachePromise) {
    cachePromise = (async () => {
      const [
        rootColumns,
        docColumns,
        rootClients,
        rootEntities,
        rootBanks,
        docClients,
        docEntities,
        docBanks
      ] = await Promise.all([
        fetchColumns(TENANT_CONFIG.sites.prodHome),
        fetchColumns(TENANT_CONFIG.sites.docCenter),
        fetchTaxonomyTerms(webUrl, 'root', 'clients'),
        fetchTaxonomyTerms(webUrl, 'root', 'entities'),
        fetchTaxonomyTerms(webUrl, 'root', 'banks'),
        fetchTaxonomyTerms(webUrl, 'docCenter', 'clients'),
        fetchTaxonomyTerms(webUrl, 'docCenter', 'entities'),
        fetchTaxonomyTerms(webUrl, 'docCenter', 'banks')
      ]);

      return {
        rootSiteColumns: replaceArrayContents(RootSiteColumns, rootColumns),
        docCenterColumns: replaceArrayContents(DocCenterColumns, docColumns),
        rootSiteClients: replaceArrayContents(RootSiteClients, rootClients),
        rootSiteEntities: replaceArrayContents(RootSiteEntities, rootEntities),
        rootSiteBanks: replaceArrayContents(RootSiteBanks, rootBanks),
        docCenterClients: replaceArrayContents(DocCenterClients, docClients),
        docCenterEntities: replaceArrayContents(DocCenterEntities, docEntities),
        docCenterBanks: replaceArrayContents(DocCenterBanks, docBanks)
      };
    })();
  }

  return cachePromise;
};
