class RangeNote extends RangeBase {
    static createNote(text, targetNode = null) {
        const ranges = this._getSelectionRanges();

        if (!text || (!ranges.length && !targetNode))
            return null;

        const noteId = 
            document.querySelectorAll(`.${this.START_NOTE_CLASS_NAME},.${this.SOLID_NOTE_CLASS_NAME}`).length + 1;

        let success = false;
            
        const noteLink = new NoteLink(noteId, text);

        if (ranges.length)
            success = this._appendNoteToRanges(ranges, noteId, text);
        else
            success = this._appendNoteToNode(targetNode, noteId, text);

        return success ? noteLink : null;
    }

    static get START_NOTE_CLASS_NAME() {
        return 'marker-start-note';
    }

    static get NOTE_CLASS_NAME() {
        return 'marker--note';
    }

    static _appendNoteToRanges(ranges, noteId, text) {
        const successfully = this._appendNoteToRangeNodes(ranges, noteId, text);

        ranges.forEach(r => this._collapseRange(r));
     
        return successfully;
    }

    static _appendNoteToRangeNodes(ranges, noteId, text) {
        if (!ranges || !ranges.length)
            return false;

        ranges.forEach(range => {            
            const endOffset = range.endOffset;
            const skipLastNode = !endOffset;
    
            const selectedNodes = this._getSelectedTextNodes(range);
    
            let lastNodeIndex = selectedNodes.length - (skipLastNode ? 1 : 0) - 1;
            lastNodeIndex = lastNodeIndex <= 0 ? 0: lastNodeIndex;
            const isSingleNode = !lastNodeIndex;
    
            if (isSingleNode) {
                const noteNode = this._createSolidContainerNoteNode(noteId, text);

                noteNode.append(range.extractContents());
                range.insertNode(noteNode);
    
                return true;
            }
        
            const startOffset = range.startOffset;
    
            const firstNode = selectedNodes[0];
            const useFirstNodePartially = startOffset > 0;
    
            const startNoteEl = this._createStartContainerNoteNode(noteId, text);
    
            if (useFirstNodePartially) {
                const val = firstNode.nodeValue;
                firstNode.nodeValue = val.substring(0, startOffset);
    
                const fragment = document.createDocumentFragment();
                fragment.append(startNoteEl, document.createTextNode(val.substring(startOffset)));
                
                firstNode.parentElement.insertBefore(fragment, firstNode.nextSibling);
            }
            else
                firstNode.parentElement.insertBefore(startNoteEl, firstNode);
    
            const lastNode = selectedNodes[lastNodeIndex];
            const useLastNodePartially = endOffset && endOffset !== lastNode.length;
    
            const endNoteEl = this._createEndContainerNoteNode(noteId, text);
    
            if (useLastNodePartially) {
                const val = lastNode.nodeValue;
                lastNode.nodeValue = val.substring(endOffset);
    
                const fragment = document.createDocumentFragment();
                fragment.append(document.createTextNode(val.substring(0, endOffset)), endNoteEl);
                
                lastNode.parentElement.insertBefore(fragment, lastNode);
            }
            else
                lastNode.parentElement.insertBefore(endNoteEl, lastNode.nextSibling);
        });

        return true;
    }

    static _appendNoteToNode(targetNode, noteId, text) {
        const noteEl = this._createSolidContainerNoteNode(noteId, text);
        targetNode.replaceWith(noteEl);

        noteEl.append(targetNode);

        return true;
    }

    static _createStartContainerNoteNode(noteId, text) {
        return this._createContainerNoteNode(noteId, text, [this.START_NOTE_CLASS_NAME]);
    }

    static _createEndContainerNoteNode(noteId, text) {
        return this._createContainerNoteNode(noteId, text, [this.END_NOTE_CLASS_NAME]);
    }

    static get END_NOTE_CLASS_NAME() {
        return 'marker-end-note';
    }

    static _createSolidContainerNoteNode(noteId, text) {
        return this._createContainerNoteNode(noteId, text, [this.SOLID_NOTE_CLASS_NAME]);
    }

    static get SOLID_NOTE_CLASS_NAME() {
        return 'marker-solid-note';
    }
    
    static _createContainerNoteNode(noteId, text, classes = []) {
        const borderNoteNode = document.createElement('span');
        borderNoteNode.classList.add(this.HAS_NOTE_CLASS_NAME, ...classes);
        borderNoteNode.dataset.noteId = noteId;

        const noteNode = document.createElement('span');
        noteNode.classList.add(this.NOTE_CLASS_NAME);
        noteNode.innerHTML = text;

        borderNoteNode.append(noteNode);

        return borderNoteNode;
    }

    static get HAS_NOTE_CLASS_NAME() {
        return 'marker-has-note';
    }

    static hasNote(targetNode) {
        return this._getNoteElement(targetNode) !== null;
    }

    static _getNoteElement(targetNode) {
        if (!targetNode)
            return null;
        
        if (this._elementHasNote(targetNode))
            return targetNode;

        const parentElement = targetNode.parentElement;
        return this._elementHasNote(parentElement) ? parentElement : null;
    }

    static _elementHasNote(targetNode) {
        return targetNode && targetNode.classList.contains(this.HAS_NOTE_CLASS_NAME);
    }

    static removeNote(targetNode) {
        let noteId;

        if (!(targetNode = this._getNoteElement(targetNode)) || !(noteId = targetNode.dataset.noteId))
            return null;

        const noteNodes = [...document.querySelectorAll(this._getNoteSearchSelector(noteId))];
        noteNodes.forEach(n => n.childElementCount === 1 ? n.remove() : this._extractLastChildContent(n));

        return noteNodes.length > 0 ? noteId : null;        
    }

    static _getNoteSearchSelector(noteId) {
        return `.marker-has-note[data-note-id="${noteId}"]`;
    }

    static _extractLastChildContent(targetNode) {
        targetNode.replaceWith(targetNode.lastChild);
    }

    static goToNote(noteId) {
        let noteElem;

        if (!noteId || !(noteElem = document.querySelector(this._getNoteSearchSelector(noteId))))
            return;

        noteElem.scrollIntoView();
    }

    static getNoteLinks() {
        const uniqueIds = [];
        
        return [...document.getElementsByClassName(this.HAS_NOTE_CLASS_NAME)].map(n => {
            const noteId = n.dataset.noteId;

            if (noteId && !uniqueIds.includes(noteId)) {
                uniqueIds.push(noteId);
                return new NoteLink(n.dataset.noteId, n.firstElementChild.textContent);
            }

            return null;
        }).filter(n => n).sort((a, b) => a.id > b.id ? 1 : (a.id < b.id ? -1 : 0));
    }
}

class NoteLink {
    constructor(id, text) {
        this.id = '' + id;
        this.text = this._formatText(id, text);

        this._TEXT_LENGTH_LIMIT = 15;
    }

    _formatText(id, text) {
        return `${id}: ` + (text.length > this._TEXT_LENGTH_LIMIT ? 
            `${text.substring(0, this._TEXT_LENGTH_LIMIT)}...` : 
            text);
    }
}