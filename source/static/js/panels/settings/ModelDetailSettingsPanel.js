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
        settingsHTML += "<span>Color coding</span>";
        settingsHTML += "<select id='model-details-settings-scatterplots-colorcoding-select'>" +
            "  <option value='none'>None</option>" +
        "</select>";
        settingsHTML += "</div>";

        settingsHTML += "<div class='setting-option'>";
        settingsHTML += "<span>Use logarithm</span>";
        settingsHTML += "<input type='checkbox' class='inline checkbox' id='model-details-settings-scatterplots-colorcoding-uselog' value='false'>";
        settingsHTML += "</div>";

        settingsHTML += "<div class='settings-section-header'>Shepard Diagram</div>"

        // Add <select> for selection of sorting order.
        settingsHTML += "<div class='setting-option'>";
        settingsHTML += "<span>Distance metric</span>";
        settingsHTML += "<select id='model-details-settings-shepard-distancemetric-select'>" +
            "  <option value='cosine'>Cosine</option>" +
            "  <option value='euclidean' selected>Euclidean</option>" +
        "</select>";
        settingsHTML += "</div>";

        settingsHTML += "<div class='settings-section-header'>Co-ranking Matrix</div>"

        settingsHTML += "<div class='setting-option'>";
        settingsHTML += "<span>Distance metric</span>";
        settingsHTML += "<select id='model-details-settings-coranking-distancemetric-select'>" +
            "  <option value='cosine'>Cosine</option>" +
            "  <option value='euclidean' selected>Euclidean</option>" +
        "</select>";
        settingsHTML += "</div>";

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
     * @returns {{scatterplotColorCoding: *, distanceMetricCoranking: *, distanceMetricShepard: *}}
     * @private
     */
    _extractOptionValues()
    {
        return {
            scatterplotColorCoding: $("#model-details-settings-scatterplots-colorcoding-select").val(),
            scatterplotColorCodingUseLog: $("#model-details-settings-scatterplots-colorcoding-uselog").is(":checked"),
            distanceMetricShepard: $("#model-details-settings-shepard-distancemetric-select").val(),
            distanceMetricCoranking: $("#model-details-settings-coranking-distancemetric-select").val()
        }
    }

    processSettingsChange(delta)
    {
        // Do nothing (alt.: Show that settings have been propagated/updated).
    }

    /**
     * Returns current values for supported options.
     * @returns {{distanceMetricCoranking: *, distanceMetricShepard: *}}
     */
    get optionValues()
    {
        return this._optionValues;
    }

    /**
     * Sets values for colorCoding in record scatterplots.
     * @param values Array of values to show.
     */
    set scatterplotColorCodingSelectValues(values)
    {
        if (!this._colorCodingOptionsAreSet) {
            for (let value of values)
                $("#model-details-settings-scatterplots-colorcoding-select")
                    .append($("<option />")
                    .val(value)
                    .text(value));

            this._colorCodingOptionsAreSet = true;
        }

    }
}