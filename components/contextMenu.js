import { ButtonMenuItem, SeparatorMenuItem, RadioSubMenuItem } from './menuItem.js';
import { MenuIcon } from './menuIcon.js';

export class ContextMenu {
    constructor() {
        this._isDirty = false;
        this._isRendered = false;

        this.onMarking = null;
        this.onUnmarking = null;
        this.onChangingColour = null;

        new SeparatorMenuItem().addToMenu();
    
        this._markBtn = new ButtonMenuItem('mark', 'Mark selected text');
        this._unmarkBtn = new ButtonMenuItem('unmark', 'Unmark selected text');

        const defaultColourClass = 'marker-green';
        this._curColourClass = defaultColourClass;

        this._markBtn.addToSelectionMenu(async () => {
            try {
                if (!this.onMarking)
                    return;

                const tabId = await this._getCurrentTabId();
                await this.onMarking({ tabId, colourClass: this._curColourClass });
            }
            catch (ex) {
                console.error('Error while trying to mark: ' + ex.toString());
            }
        }, new MenuIcon('colourful-brush'));
    
        this._unmarkBtn.addToMenu(async () => { 
            try {
                if (!this.onUnmarking)
                    return;

                const tabId = await this._getCurrentTabId();
                await this.onUnmarking({ tabId });
            }
            catch (ex) {
                console.error('Error while trying to unmark: ' + ex.toString());
            }
        }, new MenuIcon('white-brush'));
    
        this._unmarkBtn.hide();
        
        const changeColour = async (info) => {
            try {
                this._curColourClass = info.menuItemId;

                if (!this.onChangingColour)
                    return;

                const tabId = await this._getCurrentTabId();
                await this.onChangingColour({ tabId, colourClass: this._curColourClass });
            }
            catch (ex) {
                console.error('Error while trying to change mark colour: ' + ex.toString());
            }
        };

        new SeparatorMenuItem().addToMenu();

        const paletteMenuItemId = 'palette';
        const setColourBtn = new ButtonMenuItem(paletteMenuItemId, 'Set mark colour');
        setColourBtn.addToMenu(null, new MenuIcon(paletteMenuItemId));

        new RadioSubMenuItem(defaultColourClass, setColourBtn.id, 'Green')
            .addToMenu(changeColour, new MenuIcon('green'), true);
        new RadioSubMenuItem('marker-red', setColourBtn.id, 'Red')
            .addToMenu(changeColour, new MenuIcon('red'));
        new RadioSubMenuItem('marker-pink', setColourBtn.id, 'Pink')
            .addToMenu(changeColour, new MenuIcon('pink'));
        new RadioSubMenuItem('marker-orange', setColourBtn.id, 'Orange')
            .addToMenu(changeColour, new MenuIcon('orange'));
        new RadioSubMenuItem('marker-yellow', setColourBtn.id, 'Yellow')
            .addToMenu(changeColour, new MenuIcon('yellow'));
        new RadioSubMenuItem('marker-blue', setColourBtn.id, 'Blue')
            .addToMenu(changeColour, new MenuIcon('blue'));

        browser.menus.onShown.addListener(() => {
            if (this._shouldBeRefreshed()) {
                browser.menus.refresh();
                console.log('Refreshed');
            }
        });

        browser.menus.onHidden.addListener(() => this._makePure());
    }

    _shouldBeRefreshed() { return this._isDirty && !this._isRendered; }

    _makePure() {
        this._isDirty = false;
        this._isRendered = false;
    }

    render() { this._isRendered = true; }

    get currentColourClass() { return this._curColourClass; }

    hideMarkingBtn() { this._makeDirty(this._markBtn.hide()); }

    _makeDirty(shouldBeDirty) {
        if (shouldBeDirty)
            this._isDirty = true;
    }

    showMarkingBtn() { this._makeDirty(this._markBtn.show()); }

    hideUnmarkingBtn() { this._makeDirty(this._unmarkBtn.hide()); }
    
    showUnmarkingBtn() { this._makeDirty(this._unmarkBtn.show()); }

    async _getCurrentTabId() {
        const activeTabs = await browser.tabs.query({ active: true, currentWindow: true });

        if (!activeTabs || !activeTabs.length)
            throw new Error('No active tab was obtained');

        return activeTabs[0].id;
    }
};
