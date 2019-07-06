import { MessageSender } from '../components/messageSender.js';

class Popup {
    static initialise() {
        if (Popup._initialised)
            return;

        for (const item of document.getElementsByClassName('panel-list-item'))
            item.addEventListener('click', Popup._clickCallback);

        Popup._callOnActiveTab(tab => {
            browser.tabs.sendMessage(tab.id, MessageSender.startLoadingTabState())
                .then(msg => {
                    const sender = new MessageSender(msg);

                    let sectionIsVisible = false;

                    if (sender.shouldSetLoadMenuReady()) {
                        Popup._showControl(Popup._getControl('loading'));
                        sectionIsVisible = true;
                    }

                    if (sender.shouldSetSaveMenuReady()) {
                        Popup._showControl(Popup._getControl('saving'));
                        sectionIsVisible = true;
                    }

                    if (sectionIsVisible)
                        Popup._showControl(Popup._getControl('separator'));

                });
        });

        Popup._initialised = true;
    }

    static _showControl(ctrl) {
        const hiddenClassName = 'hidden';

        if (!ctrl || !ctrl.classList.contains(hiddenClassName))
            return;			
		
        ctrl.classList.remove(hiddenClassName);
    }

    static _getControl(token) {
        return document.getElementById('tabs-' + token);
    }

    static _callOnActiveTab (callback) {
        Popup._getCurrentWindowTabs().then(tabs => {
            for (const tab of tabs) {
                if (tab.active)
                    return callback(tab, tabs);
            }
        });
    }
	
    static _getCurrentWindowTabs() {
        return browser.tabs.query({ currentWindow: true });
    }

    static async _clickCallback (e) {
        const actionId = e.currentTarget.id;
	
        try {
            switch(actionId) {
            case 'tabs-saving':
                await Popup._callOnActiveTab(tab => browser.tabs.sendMessage(tab.id, MessageSender.startSaving()));
                break;
            case 'tabs-loading':
                await Popup._callOnActiveTab(tab => browser.tabs.sendMessage(tab.id, MessageSender.startLoading()));
                break;
            case 'tabs-preferences':
                await browser.runtime.openOptionsPage();
                break;
            default:
                return;
            }
			
            window.close();
        }
        catch (ex) {
            console.error(`An error occured while performing an action '${actionId}': ${ex.toString()}`);
        }
    }
}

Popup.initialise();
