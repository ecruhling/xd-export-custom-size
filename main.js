const application = require("application")
const fs = require("uxp").storage.localFileSystem

/**
 * Removes characters which are not allowed in file names.
 *
 * @param unsanitized
 * @returns {*}
 */
const removeNotAllowedCharacters = (unsanitized) => {
    return unsanitized.replace(/[\\:*?"<>|#]/g, '')
}

/**
 * Replaces slashes with dashes.
 *
 * @param unsanitized
 * @returns {*}
 */
const dashesForSlashes = (unsanitized) => {
    return unsanitized.replace(/\//g, '-')
}

/**
 * Sanitizes file names by removing not allowed characters and replacing
 * dashes with slashes.
 *
 * Removed: \:*?"<>|#
 * Dashed: /
 */
const sanitizeName = (unsanitized) => {
    return removeNotAllowedCharacters(dashesForSlashes(unsanitized))
}

/**
 * Export image file with settings parameters.
 *
 * @param selection
 * @param scale
 * @param format
 * @returns {Promise<void>}
 */
async function exportAt(selection, scale, format) {
    const renditionSettings = []
    const folder = await fs.getFolder()
    const ext = format.toLowerCase()

    await Promise.all(selection.items.map(async (item) => {
        try {
            const base = sanitizeName(item.name)
            const fileName = `${base}.${ext}`
            const file = await folder.createFile(fileName, {overwrite: true})
            renditionSettings.push({
                node: item,
                outputFile: file,
                type: application.RenditionType[format],
                scale: scale,
                // quality only matters for JPG
                quality: format === 'JPG'
                    ? 100
                    : undefined,
            })
        } catch (e) {
            console.log(e)
        }
    }))

    application.createRenditions(renditionSettings)
        // .then((results) => {})
        .catch((error) => {
            console.log(error)
        })
}

/**
 * The export dialog.
 *
 * @returns {HTMLDialogElement}
 */
function exportDialog() {

    const dialog = document.createElement("dialog")
    const selectId = 'select'

    dialog.innerHTML = `
        <style>
            .exportCustomDialog {
                width: 310px;
            }
            .exportCustomDialog .h1 {
                align-items: center;
                justify-content: space-between;
                display: flex;
                flex-direction: row;
            }
            .exportCustomDialog .formatChoice {
                display: flex;
                justify-content: flex-start;
                align-items: center;
                margin: 5px 6px 7px;
            }
        </style>
        
        <form class="exportCustomDialog" method="dialog">
            <h1 class="h1">
                <span>Export Assets at 150%</span>
            </h1>
            <hr />
            <div class="formatChoice"><span>Format:</span>
                <select
                    id="${selectId}"
                >
                    <option
                        value="PNG"
                    >PNG</option>
                    <option
                        value="JPG"
                        selected
                    >JPG</option>
                </select>
            </div>
        
            <p>Selected assets will export at 1.5x</p>
                
            <footer>
                <button
                    id="cancel"
                    type="reset"
                    uxp-variant="primary"
                    uxp-quiet="true"
                >Cancel</button>
                <button
                    id="150percent"
                    type="submit"
                    uxp-variant="cta"
                >Export</button>
            </footer>
        </form>
	`

    let response = {
        scale: undefined,
        format: undefined,
        cancelled: false,
    }

    // set to JPG by default
    response.format = 'JPG'

    const closeOptions = {
        '#cancel': {cancelled: true},
        '#150percent': {
            scale: 1.5,
            cancelled: false,
        },
    }

    // Listening to the 'close' event is the only way I can set the dialog
    // response when ENTER is pressed (otherwise it's just an empty string)
    dialog.addEventListener('close', (evt) => {
        dialog.close(response)
    })

    Object.keys(closeOptions).forEach((key) => {
        // Clicking on a button will prepare the correct response value and then
        // directly close the dialog
        dialog.querySelector(key).addEventListener('click', () => {
            Object.assign(response, closeOptions[key])
            dialog.close()
        })

        // Focusing on a button (like when TABbing through the buttons) will prepare
        // the correct response value when closing the dialog
        dialog.querySelector(key).addEventListener('focus', (evt) => {
            Object.assign(response, closeOptions[key])
        })
    })

    // The only downside to the current approach is that the ESC key doesn't work
    // as expected. This event listener fixes that.
    dialog.addEventListener('keydown', (evt) => {
        // capture if ESC key is pressed and set the appropriate response value
        if (evt.keyCode === 27) {
            response.cancelled = true
        }
    })

    const selectEl = dialog.querySelector(selectId)

    // <select value="…"/> does not show the value as selected. Instead, get a reference to
    // the element and call setAttribute("value", …) or use the selected attribute on the
    // option tags.
    // - https://adobexdplatform.com/plugin-docs/known-issues.html
    selectEl.addEventListener('change', (evt) => {
        selectEl.setAttribute('value', evt.target.value)
        Object.assign(response, {format: evt.target.value})
    })

    document.appendChild(dialog)

    return dialog
}

/**
 * Dialog for no selection.
 *
 * @returns {HTMLDialogElement}
 */
function noSelectionDialog() {
    const dialog = document.createElement("dialog")

    dialog.innerHTML = `
        <form method="dialog">
			<p>An element must be selected to export.</p>
			<footer>
				<button
					id="ok"
					type="submit"
					uxp-variant="cta"
				>OK</button>
			</footer>
		</form>
	`
    document.appendChild(dialog)

    return dialog
}

/**
 * Show the dialog.
 *
 * @param selection
 * @returns {Promise<void>}
 */
async function showDialog(selection) {
    if (!selection.items.length) {
        const dialog = noSelectionDialog()
        await dialog.showModal()
        dialog.remove()
        return
    }

    const dialog = exportDialog()
    const response = await dialog.showModal()

    if (
        !response.cancelled &&
        typeof response.scale === 'number' &&
        typeof response.format === 'string'
    ) {
        exportAt(selection, response.scale, response.format)
    }

    dialog.remove()
}

module.exports = {
    commands: {
        "exportOneHundredFiftyPercent": showDialog,
    },
}