import { Randomiser } from './randomiser.js';
import { PageInfoHelper } from './pageInfoHelper.js';

export class StorageHelper {
    static saveRandomObjects(numberOfItems = 3) {
        const expectedPageData = [];

        for (let i = 0; i < numberOfItems; ++i)
            expectedPageData.push(this._createRandomObject());

        return Promise.all(expectedPageData
            .map(obj => new BrowserStorage(obj.key).set(obj)))
            .then(() => { return expectedPageData; });
    }

    static _createRandomObject() {
        return { 
            key: Randomiser.getRandomNumberUpToMax(),
            value: Randomiser.getRandomNumberUpToMax()
        };
    }

    static saveTestPageInfo(numberOfItems = 3, predeterminedUri = null) {
        if (!numberOfItems)
            return Promise.resolve();

        const expectedPageData = PageInfoHelper.createPageInfoArray(numberOfItems);

        if (predeterminedUri)
            expectedPageData[0].uri = predeterminedUri;

        return Promise.all(expectedPageData.map(pi => new BrowserStorage(pi.uri).set(pi)))
            .then(() => { return expectedPageData; });
    }

    static saveTestCategories(numberOfItems = 3) {
        if (!numberOfItems)
            return Promise.resolve();

        return this._saveCategories(PageInfoHelper.createCategoryArray(numberOfItems));
    }

    static _saveCategories(categories = []) {
        return new BrowserStorage('categories').set(categories)
            .then(() => { return categories; });
    }

    static saveTestPageCategories(numberOfItems = 3, defaultCategoryIndex = null) {
        if (!numberOfItems)
            return Promise.resolve();

        const pageCategories = PageInfoHelper.createPageCategoryArray(numberOfItems, defaultCategoryIndex);
        const categories = pageCategories.map(pc => PageInfoHelper.createCategory(pc.category));

        return this._saveCategories(categories).then(() => {
            return new BrowserStorage('pageCategories').set(pageCategories)
                .then(() => { return ArrayExtension.sortAsc(pageCategories, 'category'); });
        });
    }
}
