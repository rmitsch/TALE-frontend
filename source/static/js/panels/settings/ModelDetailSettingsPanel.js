import SettingsPanel from "./SettingsPanel.js";
import Utils from "../../Utils.js";

/**
 * Class for model detail settings panel.
 */
export default class DissonanceSettingsPanel extends SettingsPanel
{
    /**
     * Constructs new settings panel for model detail operator.
     * @param name
     * @param operator
     * @param parentDivID
     * @param panel
     * @param iconID
     */
    constructor(name, operator, panel, parentDivID, iconID, callback)
    {
        super(name, operator, parentDivID, iconID);
        this._panel                     = panel;
        this._colorCodingOptionsAreSet  = false;
        this._optionValues              = this._extractOptionValues();;
    }

    _createDivStructure()
    {
        let settingsHTML    = "";
        let scope           = this;

        // -----------------------------------
        // 1. Generate HTML for setting
        //    options.
        // -----------------------------------

        settingsHTML += "<div class='settings-section-header'>Low-dimensionsional Scatterplots</div>"

        settingsHTML += "<div class='setting-option'>";
        settingsHTML += "<span>Use logarithm</span>";
        settingsHTML += "<input type='checkbox' class='inline checkbox' id='model-details-settings-scatterplots-colorcoding-uselog' value='false'>";
        settingsHTML += "</div>";

        settingsHTML += "<div class='settings-section-header'>Shepard Diagram</div>"

        settingsHTML += "<div class='settings-section-header'>Co-ranking Matrix</div>"

        // -----------------------------------
        // 2. Create title and options container.
        // -----------------------------------

        // Note: Listener for table icon is added by FilterReduceOperator, since it requires information about the table
        // panel.
        $("#" + this._target).html(
            "<div class='settings-content'>" + settingsHTML + "</div>" +
            "<button class='pure-button pure-button-primary settings-update-button' id='" + scope._applyChangesButtonID + "'>Apply changes</button>"
        );

        return {
            content: this._target
        };
    }

    _applyOptionChanges()
    {
        this._optionValues = this._extractOptionValues();
        this._panel.processSettingsChange(this._optionValues);
    }

    /**
     * Extracts option values from UI elements.
     * @returns {{scatterplotColorCoding: *}}
     * @private
     */
    _extractOptionValues()
    {
        return {
            scatterplotColorCodingUseLog: $("#model-details-settings-scatterplots-colorcoding-uselog").is(":checked"),
        }
    }

    processSettingsChange(delta)
    {
        // Do nothing (alt.: Show that settings have been propagated/updated).
    }

    /**
     * Returns current values for supported options.
     * @returns {{scatterplotColorCoding: *}}
     */
    get optionValues()
    {
        return this._optionValues;
    }
}
