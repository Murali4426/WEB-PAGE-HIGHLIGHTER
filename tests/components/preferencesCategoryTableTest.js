import assert from 'assert';
import { EnvLoader } from '../tools/envLoader.js';
import { BrowserMocked } from '../tools/browserMocked';
import { Randomiser } from '../tools/randomiser.js';
import { Expectation } from '../tools/expectation.js';
import { Preferences } from '../../components/preferences.js';
import { CategoryPreferencesDOM } from '../tools/preferencesDOM.js';
import { StorageHelper } from '../tools/storageHelper.js';
import { PageInfoHelper } from '../tools/pageInfoHelper.js';

describe('components/preferences/categoryTable', function () {
    this.timeout(0);

    const browserMocked = new BrowserMocked();

    beforeEach('loadResources', done => {
        browserMocked.resetBrowserStorage();

        CategoryPreferencesDOM.loadDomModel().then(() => done()).catch(done);
    });
    
    before(done => {
        EnvLoader.loadClass('./content_scripts/pageInfo.js', 'PageInfo').then(() => done())
            .catch(done);
    });

    afterEach('releaseResources', () => {        
        EnvLoader.unloadDomModel();
    });

    const categoryTableDOM = new CategoryPreferencesDOM();

    describe('#add', function () {

        it('should assure that the button adding categories is enabled despite checked rows', () =>
            Expectation.expectResolution(StorageHelper.saveTestCategories(3), 
                () => new Preferences().load().then(() => {
                    const addBtn = categoryTableDOM.getAddingBtn();
                    assert(!addBtn.disabled);

                    categoryTableDOM.tickRowCheck(1);
                    assert(!addBtn.disabled);

                    categoryTableDOM.tickAllRowsCheck();
                    assert(!addBtn.disabled);

                    categoryTableDOM.tickAllRowsCheck();
                    assert(!addBtn.disabled);
                }))
        );

        const addCategories = (count, onAlertFn, expectedItems = []) => {
            const addBtn = categoryTableDOM.getAddingBtn();

            const inputData = [];

            let shouldIncludeInput;
            global.alert = msg => {
                shouldIncludeInput = false;

                onAlertFn(msg);
            };

            for (let i = 0; i < count; ++i) {
                shouldIncludeInput = true;

                let expectedInput;
                global.prompt = () => 
                    expectedInput = '' + (expectedItems[i] || Randomiser.getRandomNumberUpToMax());

                categoryTableDOM.dispatchClickEvent(addBtn);
                assert(expectedInput);

                if (shouldIncludeInput)
                    inputData.push(expectedInput);
            }

            return inputData;
        };

        it('should add a few new categories in UI', () =>
            Expectation.expectResolution(new Preferences().load(),
                () => {
                    const onAlert = msg => 
                        assert.fail('An unexpected error while adding a new category: ' + msg);

                    categoryTableDOM.assertTableValues(
                        addCategories(5, onAlert).map(c => PageInfoHelper.createCategory(c)));
                })
        );

        it('should save new categories', () =>
            Expectation.expectResolution(StorageHelper.saveTestCategories(),
                async categories => {
                    const preferences = new Preferences();

                    await preferences.load();
                    
                    const onAlert = msg => 
                        assert.fail('An unexpected error while adding a new category: ' + msg);

                    categories.push(...addCategories(3, onAlert).map(c => PageInfoHelper.createCategory(c)));

                    await preferences.save();
                    
                    const savedCategories = await PageInfo.getAllSavedCategories();
                    assert.strictEqual(savedCategories.length, categories.length);
                    assert(savedCategories.every(sc => 
                        categories.find(c => sc.title === c.title && sc.default === c.default) !== null));
                })
        );

        it('should warn while adding a category with an existent name', () => 
            Expectation.expectResolution(new Preferences().load(), 
                () => {
                    const duplicatedCategoryName = Randomiser.getRandomNumberUpToMax();

                    let hasWarning = false;
                    const onAlert = msg => {
                        hasWarning = true;

                        assert(msg.indexOf(duplicatedCategoryName) !== -1);
                    };

                    const altogether = 5;
                    const newItems = addCategories(altogether, onAlert, 
                        [duplicatedCategoryName, duplicatedCategoryName]);

                    assert.strictEqual(hasWarning, true);
                    categoryTableDOM.assertTableValues(newItems.map(
                        c => PageInfoHelper.createCategory(c)));
                })
        );
    });


    describe('#makeDefault', function () {

        it('should disable the button when several rows are checked', () => {
            return Expectation.expectResolution(StorageHelper.saveTestCategories(),
                () => new Preferences().load()
                    .then(() => {
                        categoryTableDOM.tickRowCheck(2);
                        assert(categoryTableDOM.getMakingDefaultBtn().disabled);
                    })
            );
        });

        const markAnotherCategoryDefault = categories => {
            let newDefCategoryIndex;
            const curDefCategory = ArrayExtension.sortAsc(categories, 'title').find((c, index) => {
                if (c.default)
                    return true;
                
                newDefCategoryIndex = index;
                return false;
            });

            assert(curDefCategory);

            newDefCategoryIndex = newDefCategoryIndex >= 0 ? newDefCategoryIndex: categories.length - 1;
            const defaultCatTitle = categoryTableDOM.tickRowCheckByIndex(newDefCategoryIndex);

            categoryTableDOM.dispatchClickEvent(categoryTableDOM.getMakingDefaultBtn());

            return defaultCatTitle;
        };

        it('should save another default category', () =>
            Expectation.expectResolution(StorageHelper.saveTestCategories(),
                async categories => {
                    const preferences = new Preferences();

                    await preferences.load();

                    const defaultCatTitle = markAnotherCategoryDefault(categories);

                    await preferences.save();
                    
                    const savedCategories = await PageInfo.getAllSavedCategories();
                    assert.strictEqual(savedCategories.length, categories.length);

                    const defaultCategories = savedCategories.filter(sc => sc.default === true);
                    assert.strictEqual(defaultCategories.length, 1);
                    assert.strictEqual(defaultCategories[0].title, defaultCatTitle);
                })
        );

        it('should make another category default', () => {
            return Expectation.expectResolution(StorageHelper.saveTestCategories(5),
                categories => new Preferences().load()
                    .then(() => {
                        const categoryTitle = markAnotherCategoryDefault(categories);

                        assert(categories.find(c => c.title === categoryTitle && c.default));
                        categoryTableDOM.assertTableValues(categories);

                        categoryTableDOM.dispatchClickEvent(
                            categoryTableDOM.getMakingDefaultBtn());
                        assert(categories.every(c => !c.default));
                    })
            );
        });
    });


    describe('#remove', function () {

        it('should enable button for removing several categories', () => {
            return Expectation.expectResolution(StorageHelper.saveTestCategories(),
                () => new Preferences().load()
                    .then(() => {
                        categoryTableDOM.tickRowCheck(2);
                        assert(!categoryTableDOM.getRemovingBtn().disabled);
                    })
            );
        });
    
        it('should enable button for removing when all categories are checked', () => {
            return Expectation.expectResolution(StorageHelper.saveTestCategories(),
                () => new Preferences().load()
                    .then(() => {
                        categoryTableDOM.tickAllRowsCheck();
                        assert(!categoryTableDOM.getRemovingBtn().disabled);
                    })
            );
        });

        it('should remove several categories', () =>
            Expectation.expectResolution(StorageHelper.saveTestCategories()
                .then(async expectedPageData => {
                    const preferences = new Preferences();

                    await preferences.load();

                    const titlesForRemoval = categoryTableDOM.tickRowCheck(2);

                    const btn = categoryTableDOM.getRemovingBtn();
                    assert(!btn.disabled);
                    
                    categoryTableDOM.dispatchClickEvent(btn);

                    await preferences.save();

                    const categories = await PageInfo.getAllSavedCategories();
                    assert.deepStrictEqual(categories, 
                        expectedPageData.filter(c => !titlesForRemoval.includes(c.title)));
                }))
        );
    });

});
