
import { config } from "../package.json";
import { getString, initLocale } from "./modules/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";

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
    ztoolkit.log("????")
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


    const icon = '✨'
    toggle.textContent = icon

    toggle.setAttribute('class', "toolbarButton")
    let area = false;

    let unlisten: (() => void)[] = []

    function unlistenAll() {
        for (const u of unlisten) {
            u();
        }
    }
    toggle.onclick = () => {
        area = !area;
        if (area) {
            ztoolkit.log("entering...")
            const nodes = readerWindow.document.querySelectorAll("div#viewer > div.page")

            for (const node of nodes) {
                let div: HTMLDivElement | null = null;
                let sx = 0, sy = 0
                function mousedown(event: MouseEventInit) {
                    div = readerWindow.document.createElement("div");
                    div.style.position = "absolute";

                    div.style.background = "blue"
                    div.style.opacity = "30%"
                    node.appendChild(div)
                    sx = event.clientX!;
                    sy = event.clientY!;
                    ztoolkit.log("md", event.clientX, event.clientY);
                }
                function mousemove(event: MouseEventInit) {
                    (event as MouseEvent).preventDefault();

                    if (!div) return;

                    const ex = event.clientX!, ey = event.clientY!

                    // set div's left, top, width and height
                    const width = Math.abs(ex - sx), height = Math.abs(ey - sy)
                    const left = Math.min(sx, ex), top = Math.min(sy, ey);
                    div.style.left = `${left}px`;
                    div.style.top = `${top}px`;
                    div.style.width = `${width}px`;
                    div.style.height = `${height}px`;

                    ztoolkit.log(event.clientX, event.clientY);

                }
                function mouseup(event: MouseEventInit) {
                    (event as MouseEvent).preventDefault();
                    if (!div) return;

                    node.removeChild(div);
                    ztoolkit.log("e", event.clientX, event.clientY);

                    unlistenAll();
                }
                node.addEventListener("mousedown", mousedown);
                node.addEventListener("mousemove", mousemove);
                node.addEventListener("mouseup", mouseup);
                unlisten.push(() => {
                    node.removeEventListener("mousedown", mousedown);
                    node.removeEventListener("mousemove", mousemove);
                    node.removeEventListener("mouseup", mouseup);
                    if (div) { node.removeChild(div); }
                })
            }
        } else {
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
    ztoolkit.log("notify", event, type, ids, extraData);

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
