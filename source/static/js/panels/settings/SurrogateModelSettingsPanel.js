import SettingsPanel from "./SettingsPanel.js";
import Utils from "../../Utils.js";

/**
 * Class for surrogate model settings panel.
 */
export default class SurrogateModelSettingsPanel extends SettingsPanel
{
    /**
     * Constructs new settings panel for surrogate model operator.
     * @param name
     * @param operator
     * @param parentDivID
     * @param iconID
     */
    constructor(name, operator, parentDivID, iconID)
    {
        super(name, operator, parentDivID, iconID);
    }

    _createDivStructure()
    {
        let settingsHTML    = "";
        let scope           = this;

        // -----------------------------------
        // 1. Generate HTML for setting
        //    options.
        // -----------------------------------

        // Add selection of target objective.
        settingsHTML += "<div class='setting-option'>";
        settingsHTML += "<span id='surrogate-settings-target-objective'>Target objective</span>";
        settingsHTML += "<select id='surrogate-settings-target-objective-select'>" +
            "  <option value='r_nx'>R<sub>nx</sub></option>" +
            "  <option value='runtime'>Runtime</option>" +
            "  <option value='stress'>Stress</option>" +
            "  <option value='target_domain_performance'>Target domain performance</option>" +
            "  <option value='separability_metric'>Separability</option>" +
        "</select>";
        settingsHTML += "</div>";

        // -----------------------------------
        // 2. Create title and options container.
        // -----------------------------------

        $("#" + this._target).html(
            "<div class='settings-content'>" + settingsHTML + "</div>" +
            "<button class='pure-button pure-button-primary settings-update-button' id='" + scope._applyChangesButtonID + "'>Apply changes</button>"
        );

        return {
            content: this._target
        };
    }

    /**
     * Extracts currently chosen settings for surrogate model.
     * @returns {{objectives: *}}
     */
    static getOptionValues()
    {
        return {objective: $("#surrogate-settings-target-objective-select").val()};
    }

    processSettingsChange(delta)
    {
        // Do nothing (alt.: Show that settings have been propagated/updated).
    }

    _applyOptionChanges()
    {
        // Update chart.
        this._operator.updateSurrogateModelChart();
    }
}