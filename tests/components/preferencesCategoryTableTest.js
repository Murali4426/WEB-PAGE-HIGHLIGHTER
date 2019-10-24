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

        it('should add a few new categories', () =>
            Expectation.expectResolution(new Preferences().load(),
                () => {
                    const onAlert = msg => 
                        assert.fail('An unexpected error while adding a new category: ' + msg);

                    categoryTableDOM.assertTableValues(
                        addCategories(5, onAlert).map(PageInfoHelper.createCategory));
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
                    categoryTableDOM.assertTableValues(newItems.map(PageInfoHelper.createCategory));
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

        it('should make another category default', () => {
            return Expectation.expectResolution(StorageHelper.saveTestCategories(5),
                categories => new Preferences().load()
                    .then(() => {
                        let newDefCategoryIndex;
                        const curDefCategory = categories.find((c, index) => {
                            if (c.default)
                                return true;
                            
                            newDefCategoryIndex = index;
                            return false;
                        });

                        assert(curDefCategory);

                        newDefCategoryIndex = newDefCategoryIndex >= 0 || categories.length - 1;
                        const categoryTitle = categoryTableDOM.tickRowCheck(newDefCategoryIndex)[0];

                        categoryTableDOM.dispatchClickEvent(
                            categoryTableDOM.getMakingDefaultBtn());
                        assert(categories.find(c => c.title === categoryTitle && c.default));
                        categoryTableDOM.assertTableValues(categories);

                        categoryTableDOM.dispatchClickEvent(
                            categoryTableDOM.getMakingDefaultBtn());
                        assert(categories.every(c => !c.default));
                    })
            );
        });
    });

});
