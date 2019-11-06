class Category {
    static async upsert(categorisedUris = {}) {
        if (!Object.getOwnPropertyNames(categorisedUris).length)
            return;

        const newCategories = new Set(Object.values(categorisedUris));
        const categoryStorage = this._createStorage();
        const storedCategories = (await categoryStorage.get()) || [];

        let newCategoryWasAdded = false;
        newCategories.forEach(val => {
            if (!storedCategories.find(c => c.title === val)) {
                storedCategories.push(this._createCategory(val));
                newCategoryWasAdded = true;
            }
        });

        if (newCategoryWasAdded)
            await categoryStorage.set(storedCategories);

        return storedCategories;
    }

    static _createCategory(title, isDefault = false) {
        return  {
            default: isDefault,
            title
        };
    }

    static _createStorage() {
        return new BrowserStorage('categories');
    }

    static get() {
        return this._createStorage().get();
    }

    static save(data) {
        return this._createStorage().set(data);
    }
}

class PageCategory {
    constructor(uri) {
        this._uri = uri;
        this._storage = null;

        this._category = null;
    }

    async load() {
        this._category = await this._getPageCategory();
    }

    async _getPageCategory() {
        const pageCategories = await this._browserStorage.get();
        return pageCategories[this._uri];
    }

    get _browserStorage() {
        if (!this._storage)
            this._storage = PageCategory._createStorage();

        return this._storage;
    }

    static _createStorage() {
        return new BrowserStorage('pageCategories');
    }

    async update(categoryTitle) {
        if (categoryTitle === null || this._category === categoryTitle)
            return;

        const pageCategories = await this._browserStorage.get();

        if (categoryTitle)
            pageCategories[this._uri] = categoryTitle;
        else
            delete pageCategories[this._uri];
        
        await this._browserStorage.set(pageCategories);

        this._category = categoryTitle;
    }

    static async upsert(categorisedUris = {}) {
        if (!Object.getOwnPropertyNames(categorisedUris).length)
            return;

        const pageCategoryStorage = this._createStorage();
        const storedPageCategories = (await pageCategoryStorage.get()) || {};
            
        for (const uri in categorisedUris)
            storedPageCategories[uri] = categorisedUris[uri];
        
        await pageCategoryStorage.set(storedPageCategories);

        return storedPageCategories;
    }
    
    static save(data) {
        return this._createStorage().set(data);
    }

    static get() {
        return this._createStorage().get();
    }
}

class PageInfo {
    constructor () {
        this._uri = this._computeUri();
        this._storage = null;

        this._pageCategory = new PageCategory(this._uri);
    }

    _computeUri() {
        const location = document.location;
        return location.origin + location.pathname;
    }

    static get HTML_PROP_NAME() { 
        return 'htmlBase64'; 
    }

    async save(categoryTitle = null) {
        await this._pageCategory.update(categoryTitle);
        
        return this._browserStorage.set(this._serialise());
    }

    get _browserStorage() {
        if (!this._storage)
            this._storage = new BrowserStorage(this._uri);

        return this._storage;
    }

    _serialise() {
        return { 
            date: Date.now(),
            title: document.title,
            [PageInfo.HTML_PROP_NAME]: this._serialisedHtml
        };
    }

    get _serialisedHtml() {
        return LZWCompressor.compress(document.body.innerHTML);
    }

    async canLoad() {
        return await this._browserStorage.contains();
    }

    async load() {
        const pageData = await this._browserStorage.get();

        let serialisedHtml;

        if (!pageData || !(serialisedHtml = pageData[PageInfo.HTML_PROP_NAME]))
            this._throwNoContentError();

        this._renderHtml(this._deserialiseHtml(serialisedHtml));

        this._pageCategory.load();
    }

    _throwNoContentError() {
        const error = new Error('There is no HTML contents to write');
        error.name = 'WrongHtmlError';

        throw error;
    }

    _deserialiseHtml(serialisedHtml) {
        return LZWCompressor.decompress(serialisedHtml);
    }

    _renderHtml(html) {
        if (!html)
            this._throwNoContentError();

        document.body.innerHTML = html;
    }

    static _isUriValid(uri) {
        try {
            new URL(uri);
            return true;
        }
        catch (ex) {
            return false;
        }
    }

    shouldLoad() {
        return document.location.hash === PageInfo._LOADING_HASH;
    }

    static get _LOADING_HASH() {
        return '#highlighterPageLoading';
    }

    static getAllSavedPagesWithCategories() {
        return this._getAllSavedPagesInfo();
    }

    static async _getAllSavedPagesInfo(includeHtml = false) {
        const objs = await BrowserStorage.getAll();
    
        const props = Object.getOwnPropertyNames(objs);

        const pagesInfo = [];

        const htmlPropName = this.HTML_PROP_NAME;

        ArrayExtension.runForEach(props, prop => {
            if (!this._isUriValid(prop))
                return;

            const obj = objs[prop];

            const pageInfo = {
                uri: prop, 
                title: obj.title,
                date: obj.date
            };

            if (includeHtml)
                pageInfo[htmlPropName] = obj[htmlPropName];
            
            pagesInfo.push(pageInfo);
        });

        return {
            pageCategories: (await PageCategory.get()) || {},
            pagesInfo
        };
    }

    static getAllSavedPagesFullInfo() {
        return this._getAllSavedPagesInfo(true).then(info => {
            if (!info.pagesInfo.length)
                return info.pagesInfo;
            
            ArrayExtension.runForEach(info.pagesInfo, pi => {
                const categoryTitle = info.pageCategories[pi.uri];
                
                if (categoryTitle)
                    pi.category = categoryTitle;
            });

            return info.pagesInfo;
        });
    }

    static generateLoadingUrl(url) {
        return url + this._LOADING_HASH;
    }

    static remove(pageUris = []) {
        return BrowserStorage.remove(pageUris);
    }

    static async savePages(pagesInfo) {
        const htmlPropName = this.HTML_PROP_NAME;

        const importedFiles = [];
        const pageCategories = {};

        ArrayExtension.runForEach(pagesInfo, pi => {
            if (!this._isUriValid(pi.uri))
                return;
            
            pi.date = this._getValidTicks(pi.date);
            
            if (!pi.title)
                pi.title = this._fetchTitleFromUri(pi.uri);

            if (pi.category) {
                pageCategories[pi.uri] = pi.category;
                delete pi.category;
            }

            new BrowserStorage(pi.uri).set({
                [htmlPropName]: pi[htmlPropName],
                date: pi.date,
                title: pi.title
            });

            importedFiles.push(this._excludeHtml(pi));
        });

        const responses = await Promise.all([PageCategory.upsert(pageCategories),
            Category.upsert(pageCategories)]);
            
        return {
            importedPages: importedFiles,
            pageCategories: responses[0] || {},
            categories: responses[1] || []
        };
    }

    static _getValidTicks(ticks) {
        return isNaN(new Date(ticks)) ? Date.now() : ticks;
    }

    static _fetchTitleFromUri(uri) {
        const pathName = new URL(uri).pathname;
        const startIndex = pathName.lastIndexOf('/') + 1;
        
        if (!startIndex || startIndex === pathName.length)
            return 'Unknown';
        
        return pathName.substring(startIndex);
    }

    static _excludeHtml(pageInfo) {
        delete pageInfo[this.HTML_PROP_NAME];
        return pageInfo;
    }
    
    static getAllSavedCategories() {
        return Category.get();
    }

    static saveCategories(data) {
        return Category.save(data);
    }

    static savePageCategories(data) {
        return PageCategory.save(data);
    }
}
