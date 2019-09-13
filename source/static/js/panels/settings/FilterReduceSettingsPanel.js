import SettingsPanel from "./SettingsPanel.js";
import Utils from "../../Utils.js";

/**
 * Class for filter reduce operator settings panel.
 */
export default class FilterReduceSettingsPanel extends SettingsPanel {
    /**
     * Constructs new settings panel for filter reduce operator.
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
        // -----------------------------------
        // 1. Generate HTML for setting
        //    options.
        // -----------------------------------

        let settingsHTML = "";

        // Settings for lines' opacity.
        settingsHTML += "<div class='setting-option'>";

        settingsHTML += "<div class='settings-section-header'>Line opacity</div>";
        // Bin fraction.
        settingsHTML += "<div class='settings-subsection'>";
        settingsHTML += "<span id='filter-reduce-settings-line-opacity-bin-fraction'>Number of steps</span>";
        settingsHTML += "<input type='number' id='filter-reduce-bin-number' min='1' max='10000' step='1' value='10'>";
        settingsHTML += "</div>";

        // Logarithmic scaling.
        settingsHTML += "<div class='settings-subsection'>";
        settingsHTML += "<span id='filter-reduce-settings-line-opacity-log-scaling'>Use log. scaling</span>";
        settingsHTML += "<input id='filter-reduce-settings-line-log-scale' type='checkbox'>"
        settingsHTML += "</div>";

        settingsHTML += "</div>";

        // Settings for SSP opacity w.r.t. correlation strength.
        settingsHTML += "<div class='setting-option'>";

        settingsHTML += "<div class='settings-section-header'>Plot opacity</div>";
        // Type of opacity scaling.
        settingsHTML += "<div class='setting-option'>";
        settingsHTML += "<span id='filter-reduce-settings-plot-opacity-type-label'>Determine plot opacity by</span>";
        settingsHTML += "<select id='filter-reduce-settings-plot-opacity-type-select'>" +
            "  <option value='threshold'>threshold</option>" +
            "  <option value='corrStrength'>correlation strength</option>" +
        "</select>";
        settingsHTML += "</div>";

        // Minimum correlation strength.
        settingsHTML += "<div class='settings-subsection'>";
        settingsHTML += "<span id='filter-reduce-settings-min-corr-strength-label' class='filter-reduce-opacity-label'>Min. correlation strength</span>";
        settingsHTML += "<input type='number' id='filter-reduce-min-corr-strength-input' min='0' max='1' step='0.1' value='0.3'>";
        settingsHTML += "</div>";

        // Irrelevant SSP opacity value.
        settingsHTML += "<div class='settings-subsection'>";
        settingsHTML += "<span id='filter-reduce-settings-plot-opacity-irrelevant-label' class='filter-reduce-opacity-label'>Opacity for plots under threshold</span>";
        settingsHTML += "<input type='number' id='filter-reduce-settings-plot-opacity-irrelevant-input' min='0' max='1' step='0.1' value='0.25'>";
        settingsHTML += "</div>";

        settingsHTML += "</div>";

        // -----------------------------------
        // 2. Create title and options container.
        // -----------------------------------

        // Note: Listener for table icon is added by parent class, since it requires information about the table
        // panel.
        $("#" + this._target).html(
            "<div class='settings-content'>" + settingsHTML + "</div>" +
            "<button class='pure-button pure-button-primary settings-update-button' id='" + this._applyChangesButtonID + "'>Apply changes</button>"
        );

        // -----------------------------------
        // 3. Set listener.
        // -----------------------------------

        const plotOpacityDropdown       = $("#filter-reduce-settings-plot-opacity-type-select");
        const plotOpacityLabels         = $(".filter-reduce-opacity-label");
        const minCorrStrengthInput      = $("#filter-reduce-min-corr-strength-input");
        const irrelevantOpacityInput    = $("#filter-reduce-settings-plot-opacity-irrelevant-input");
        plotOpacityDropdown.change(function() {
            if (plotOpacityDropdown.val() === "threshold") {
                plotOpacityLabels.css("opacity", 1);
                minCorrStrengthInput.prop('disabled', false);
                irrelevantOpacityInput.prop('disabled', false);
            }

            else {
                plotOpacityLabels.css("opacity", 0.5);
                minCorrStrengthInput.prop('disabled', true);
                irrelevantOpacityInput.prop('disabled', true);
            }
        });

        return {
            content: this._target
        };
    }

    _applyOptionChanges()
    {
        this._operator.propagateSettingsChanges(this.options, this._name)
    }

    /**
     * Parses and returns options.
     * @returns {{plotOpacityBy: *, binFraction: *, plotOpacityOpacityUnderThreshold: *, useLogs: *, plotOpacityMinCorrStrength: *}}
     */
    get options()
    {
        return {
            binFraction: parseInt($("#filter-reduce-bin-number").val()),
            useLogs: $("#filter-reduce-settings-line-log-scale").is(":checked"),
            plotOpacityBy: $("#filter-reduce-settings-plot-opacity-type-select").val(),
            plotOpacityMinCorrStrength: parseFloat($("#filter-reduce-min-corr-strength-input").val()),
            plotOpacityOpacityUnderThreshold: parseFloat($("#filter-reduce-settings-plot-opacity-irrelevant-input").val())
        };
    }
}