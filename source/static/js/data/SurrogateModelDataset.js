import Utils from "../Utils.js";
import Dataset from "./Dataset.js";


/**
 * Wrapper class providing the specified dataset itself plus the corresponding crossfilter context and various utility
 * methods. */
export default class DRMetaDataset extends Dataset {
    /**
     *
     * @param name
     * @param data Array of objects (JSON/array/dict/...) holding data to display. Note: Length of array defines number
     * of panels (one dataset per panel) and has to be equal with length of objects in metadata.
     * @param drModelMetadata Instance of DRMetaDataset containing metadata of DR models.
     * @param supportedDRModelMeasure DR model measure(s) to consider in data.
     */
    constructor(name, data, drModelMetadata, supportedDRModelMeasure) {
        super(name, data);

        this._drModelMetadata   = drModelMetadata;
        this._measure           = supportedDRModelMeasure;
        this._axisPaddingRatio  = 0;
        this._binCount          = 5;

        // Set up containers for crossfilter data.
        this._crossfilter       = crossfilter(this._data);

        // Initialize crossfilter data.
        this._initSingularDimensionsAndGroups();
        this._initHistogramDimensionsAndGroups();

        console.log(this._crossfilter.all())
    }

    _initSingularDimensionsAndGroups()
    {
        const attributes = [
            "precision", "precision#histogram", "recall", "recall#histogram", "support", "support#histogram",
            "interval_start", "interval_end"
        ];

        for (let attribute of attributes) {
            this._cf_dimensions[attribute] = this._crossfilter.dimension(
                function(d) { return d[attribute]; }
            );

            // Find extrema.
            this._calculateSingularExtremaByAttribute(attribute);
        }
    }

    _initHistogramDimensionsAndGroups()
    {
        // Note that histogram dimensions have already been computed in backend.
        const histogramAttributes = [
            "precision#histogram", "recall#histogram", "support#histogram", "interval_start", "interval_end"
        ];

        // Create group for histogram.
        for (let histogramAttribute of histogramAttributes) {
            // Create group for histogram.
            this._cf_groups[histogramAttribute] = this._generateGroupWithCounts(histogramAttribute);

            // Calculate extrema.
            this._calculateExtremaForAttribute(histogramAttribute, "numerical");
        }
    }

    /**
     * Generates crossfilter group with information on number of elements..
     * @param attribute
     * @returns Newly generated group.
     * @private
     */
    _generateGroupWithCounts(attribute)
    {
        return this._cf_dimensions[attribute].group().reduce(
            function(elements, item) {
                elements.items.add(item);
                elements.ids.add(item.id);
                elements.count++;
                return elements;
            },
            function(elements, item) {
                elements.items.delete(item);
                elements.ids.delete(item.id);
                elements.count--;
                return elements;
            },
            function() {
                return { items: new Set(), count: 0, ids: new Set() };
            }
        );
    }
}