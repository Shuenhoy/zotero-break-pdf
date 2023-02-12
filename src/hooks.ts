
import { config } from "../package.json";
import { getString, initLocale } from "./modules/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";

class CopyHelper {
    transferable: any;
    clipboardService: any;

    constructor() {
        this.transferable = Components.classes[
            "@mozilla.org/widget/transferable;1"
        ].createInstance(Components.interfaces.nsITransferable);
        this.clipboardService = Components.classes[
            "@mozilla.org/widget/clipboard;1"
        ].getService(Components.interfaces.nsIClipboard);
    }

    public addText(source: string, type: "text/html" | "text/unicode") {
        const str = Components.classes[
            "@mozilla.org/supports-string;1"
        ].createInstance(Components.interfaces.nsISupportsString);
        str.data = source;
        this.transferable.addDataFlavor(type);
        this.transferable.setTransferData(type, str, source.length * 2);
        return this;
    }

    public copy() {
        this.clipboardService.setData(
            this.transferable,
            null,
            Components.interfaces.nsIClipboard.kGlobalClipboard
        );
    }
}

async function onStartup() {
    await Promise.all([
        Zotero.initializationPromise,
        Zotero.unlockPromise,
        Zotero.uiReadyPromise,
    ]);
    initLocale();
    ztoolkit.ProgressWindow.setIconURI(
        "default",
        `chrome://${config.addonRef}/content/icons/favicon.png`
    );
    const callback = {
        notify: async (
            event: _ZoteroTypes.Notifier.Event,
            type: _ZoteroTypes.Notifier.Type,
            ids: string[] | number[],
            extraData: { [key: string]: any }
        ) => {

            addon.hooks.onNotify(event, type, ids as string[], extraData);
        },
    };

    // Register the callback in Zotero as an item observer
    const notifierID = Zotero.Notifier.registerObserver(callback, [
        "tab",
        "item",
        "file",
    ]);

}

function onShutdown(): void {
    ztoolkit.unregisterAll();
    // Remove addon object
    addon.data.alive = false;
    delete Zotero[config.addonInstance];
}

function addEverythingForTab(readerWindow: Window) {

    const toggle: HTMLButtonElement =
        readerWindow.document.createElement('button')

    toggle.setAttribute('id', 'night-toggle')


    const icon = 'B'
    toggle.textContent = icon

    toggle.setAttribute('class', "toolbarButton")
    let area = false;

    let unlisten: (() => void)[] = []

    function unlistenAll() {
        for (const u of unlisten) {
            u();
        }
        unlisten = [];
    }
    toggle.onclick = () => {
        area = !area;
        if (area) {
            toggle.style.background = "#e3e3ff"
            const nodes = readerWindow.document.querySelectorAll("div#viewer > div.page")

            for (const [id, node] of nodes.entries()) {
                const selection = node.querySelector("canvas.selectionCanvas") as HTMLCanvasElement
                selection.style.display = "none";

                let div: HTMLDivElement | null = null;
                let sx = 0, sy = 0
                function mousedown(event: MouseEventInit) {
                    const ev = event as MouseEvent
                    ev.preventDefault();

                    div = readerWindow.document.createElement("div");
                    div.style.position = "absolute";

                    div.style.background = "blue"
                    div.style.opacity = "30%"
                    node.appendChild(div)
                    sx = ev.offsetX!;
                    sy = ev.offsetY!;
                }
                function mousemove(event: MouseEventInit) {
                    const ev = event as MouseEvent

                    ev.preventDefault();

                    if (!div) return;

                    const ex = ev.offsetX!, ey = ev.offsetY!

                    // set div's left, top, width and height
                    const width = Math.abs(ex - sx), height = Math.abs(ey - sy)
                    const left = Math.min(sx, ex), top = Math.min(sy, ey);
                    div.style.left = `${left}px`;
                    div.style.top = `${top}px`;
                    div.style.width = `${width}px`;
                    div.style.height = `${height}px`;


                }
                function mouseup(event: MouseEventInit) {
                    const ev = event as MouseEvent

                    ev.preventDefault();
                    if (!div) return;

                    const ex = ev.offsetX!, ey = ev.offsetY!
                    const width = Math.abs(ex - sx), height = Math.abs(ey - sy)
                    const left = Math.min(sx, ex), top = Math.min(sy, ey);

                    const pageWidth = node.clientWidth, pageHeight = node.clientHeight

                    const item = Zotero.Items.get(Zotero.Reader.getByTabID(Zotero_Tabs.selectedID).itemID!)

                    const json = JSON.stringify({
                        url: `zotero://${item.key}/${(item as any).getFilename()}`,
                        page: id + 1,
                        rect: [left / pageWidth, top / pageHeight, height / pageHeight, width / pageWidth]
                    });
                    new CopyHelper().addText(
                        "```pdf\n" + json + "\n```"
                        , "text/unicode").copy();
                    node.removeChild(div);

                }
                node.addEventListener("mousedown", mousedown);
                node.addEventListener("mousemove", mousemove);
                node.addEventListener("mouseup", mouseup);
                unlisten.push(() => {
                    node.removeEventListener("mousedown", mousedown);
                    node.removeEventListener("mousemove", mousemove);
                    node.removeEventListener("mouseup", mouseup);
                    selection.style.display = "block";
                    if (div) { node.removeChild(div); }
                })
            }
        } else {
            toggle.style.removeProperty("background");
            unlistenAll();
        }
    }

    const middleToolbar = readerWindow.document.querySelector(
        '#toolbarViewerMiddle',
    )

    if (!middleToolbar) {
        return
    }

    middleToolbar.prepend(toggle)
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
    event: string,
    type: string,
    ids: Array<string>,
    extraData: { [key: string]: any }
) {

    if (event === 'add') {

        // const tabWindow = this.getTabWindowById(ids[0])
        const reader = Zotero.Reader.getByTabID(ids[0])
        await reader._initPromise
        const tabWindow = reader._iframeWindow as Window

        switch (tabWindow.document.readyState) {
            // @ts-expect-error uninitialized does exist actually
            case 'uninitialized': {
                setTimeout(() => {
                    addEverythingForTab(tabWindow)

                }, 300)
                return
            }
            case 'complete': {
                addEverythingForTab(tabWindow)
            }
        }
    }
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
    switch (type) {
        case "load":
            registerPrefsScripts(data.window);
            break;
        default:
            return;
    }
}

function onShortcuts(type: string) {
}

function onDialogEvents(type: string) {

}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintian.

export default {
    onStartup,
    onShutdown,
    onNotify,
    onPrefsEvent,
    onShortcuts,
    onDialogEvents,
};
