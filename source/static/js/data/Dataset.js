/**
 * Abstract parent class for all datasets.
 */
export default class Dataset
{
    constructor(name, data)
    {
        this._name = name;
        this._data = data;

        this._cf_dimensions = {};
        this._cf_extrema    = {};
        this._cf_groups     = {};
        this._cf_intervals  = {};

        // Defines how much padding (relative to the shown interval) any axis should have.
        this._axisPaddingRatio  = 0;
    }

    get name()
    {
        return this._name;
    }

    get data()
    {
        return this._data;
    }

    /**
     * Initializes singular dimensions.
     * Note: Creates dimensions for all attribute by default. If not desired, columns have to be dropped beforehand.
     */
    _initSingularDimensionsAndGroups()
    {
        throw new TypeError("Dataset._determineExtrema(): Abstract method must not be called.");
    }

    /**
     * Initializes binary dimensions (for e. g. scatterplots or heatmaps).
     * @param includeGroups Determines whether groups for binary dimensions should be generated as well.
     */
    _initBinaryDimensionsAndGroups(includeGroups = true)
    {
        throw new TypeError("Dataset._initBinaryDimensionsAndGroups(): Abstract method must not be called.");
    }

    /**
     * Initializes singular dimensions and calculates extrema for specified attribute.
     * @param attribute
     * @private
     */
    _initSingularDimension(attribute)
    {
        throw new TypeError("Dataset._initSingularDimension(): Abstract method must not be called.");
    }

    /**
     * Calculates extrema for one singular dimension.
     * @param attribute
     * @returns {{}}
     * @private
     */
    _calculateSingularExtremaByAttribute(attribute)
    {
        // Calculate extrema for singular dimensions.
        this._cf_extrema[attribute] = {
            min: this._cf_dimensions[attribute].bottom(1)[0][attribute],
            max: this._cf_dimensions[attribute].top(1)[0][attribute]
        };

        // Update extrema by padding values (hardcoded to 10%) for x-axis.
        this._cf_intervals[attribute]   = this._cf_extrema[attribute].max - this._cf_extrema[attribute].min;

        // Add padding, if specified. Goal: Make also fringe elements clearly visible (other approach?).
        if (this._axisPaddingRatio > 0) {
            this._cf_extrema[attribute].min -= this._cf_intervals[attribute] / this._axisPaddingRatio;
            this._cf_extrema[attribute].max += this._cf_intervals[attribute] / this._axisPaddingRatio;
        }
    }

    /**
     * Calculates extrema for one singular dimension.
     * @param dimension
     * @param attribute
     * @returns {{}} Dictionary with {extrema: {min: ..., max: ...}, interval: ...}
     * @private
     */
    _calculateSingularExtremaByDimension(dimension, attribute)
    {
        // Calculate extrema for singular dimensions.
        let extrema = {
            min: dimension.bottom(1)[0][attribute],
            max: dimension.top(1)[0][attribute]
        };

        // Update extrema by padding values (hardcoded to 10%) for x-axis.
        let interval = extrema.max - extrema.min;

        // Add padding, if specified. Goal: Make also fringe elements clearly visible (other approach?).
        if (this._axisPaddingRatio > 0) {
            extrema.min -= interval / this._axisPaddingRatio;
            extrema.max += interval / this._axisPaddingRatio;
        }

        return {extrema: extrema, interval: interval};
    }

    /**
     * Generates crossfilter group with information on number of elements..
     * @param attribute
     * @param primitiveAttributes List of relevenat attributes in original records. Extrema information is only
     * collected for these. Note of caution: Extrema are not to be considered reliable, since they aren't
     * updated after splicing operations (still sufficient for barchart highlighting operations though, since barchart/
     * group widths on x-axis don't change after splicing).
     * @returns Newly generated group.
     * @private
     */
    _generateGroupWithCounts(attribute, primitiveAttributes)
    {
        return this._cf_dimensions[attribute].group().reduce(
            function(elements, item) {
               elements.items.push(item);
               elements.count++;
               // Update extrema.
               for (let attr in elements.extrema) {
                   elements.extrema[attr].min = item[attr] < elements.extrema[attr].min ? item[attr] : elements.extrema[attr].min;
                   elements.extrema[attr].max = item[attr] > elements.extrema[attr].max ? item[attr] : elements.extrema[attr].max;
               }

               return elements;
            },
            function(elements, item) {
                elements.items.splice(elements.items.indexOf(item), 1);
                elements.count--;
                return elements;
            },
            function() {
                let extrema = {};
                for (let i = 0; i < primitiveAttributes.length; i++)
                    extrema[primitiveAttributes[i]] = {min: Number.MAX_VALUE, max: -Number.MAX_VALUE}

                return {items: [], count: 0, extrema: extrema};
            }
        );
    }

    /**
     * Generates crossfilter group with information on number of elements without determining extrema.
     * @param attribute
     * @returns Newly generated group.
     * @private
     */
    _generateGroupWithCountsWithoutExtrema(attribute)
    {
        return Dataset._generateGroupWithCountsWithoutExtremaForArbitraryDimension(this._cf_dimensions[attribute]);
    }

    /**
     * Generates crossfilter group with information on number of elements without determining extrema.
     * @param dimension
     * @returns Newly generated group.
     * @private
     */
    static _generateGroupWithCountsWithoutExtremaForArbitraryDimension(dimension)
    {
        return dimension.group().reduce(
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

    /**
     * Generates crossfilter group with information on number of elements.
     * @param dimension
     * @param primitiveAttributes List of relevenat attributes in original records. Extrema information is only
     * collected for these. Note of caution: Extrema are not to be considered reliable, since they aren't
     * updated after splicing operations (still sufficient for barchart highlighting operations though, since barchart/
     * group widths on x-axis don't change after splicing).
     * @returns Newly generated group.
     * @private
     */
    _generateGroupWithCountsForDimension(dimension, primitiveAttributes)
    {
        return dimension.group().reduce(
            function(elements, item) {
               elements.items.push(item);
               elements.count++;
               // Update extrema.
               for (let attr in elements.extrema) {
                   elements.extrema[attr].min = item[attr] < elements.extrema[attr].min ? item[attr] : elements.extrema[attr].min;
                   elements.extrema[attr].max = item[attr] > elements.extrema[attr].max ? item[attr] : elements.extrema[attr].max;
               }

               return elements;
            },
            function(elements, item) {
                elements.items.splice(elements.items.indexOf(item), 1);
                elements.count--;
                return elements;
            },
            function() {
                let extrema = {};
                for (let i = 0; i < primitiveAttributes.length; i++)
                    extrema[primitiveAttributes[i]] = {min: Number.MAX_VALUE, max: -Number.MAX_VALUE}

                return {items: [], count: 0, extrema: extrema};
            }
        );
    }

    /**
     * Adds fields with binned values to record.
     * @param record
     * @param attributes
     * @param binnedFieldSuffix
     * @param binCount
     * @private
     */
    _addBinnedValuesToRecord(record, attributes, binnedFieldSuffix, binCount)
    {
        for (let i = 0; i < attributes.length; i++) {
            let attribute   = attributes[i];
            const binWidth  = this._cf_intervals[attribute] / binCount;
            const extrema   = this._cf_extrema[attribute];

            let value = record[attribute];
            if (value <= extrema.min)
                value = extrema.min;
            // Note: Removed `- binWidth` 2019-03-26 while fixing wrong bin computation for values in uppermost bin.
            else if (value >= extrema.max)
                value = extrema.max;

            // Adjust for extrema.
            let binnedValue = binWidth !== 0 ? Math.floor((value - extrema.min) / binWidth) * binWidth : 0;
            binnedValue += extrema.min;
            if (binnedValue > extrema.max)
                // Note: Removed `- binWidth` 2019-03-26 while fixing wrong bin computation for values in uppermost bin.
                binnedValue = extrema.max;

            record[attribute + binnedFieldSuffix] = binnedValue;
        }
    }

    /**
     * Calculates extrema for specified dimensions/groups.
     * @param attribute
     * @param dataType "categorical" or "numerical". Distinction is necessary due to diverging structure of histogram
     * data.
     */
    _calculateExtremaForAttribute(attribute, dataType)
    {
        // Calculate extrema for histograms.
        let sortedData          = JSON.parse(JSON.stringify(this._cf_groups[attribute].all()));

        // Sort data by number of entries in this attribute's histogram.
        sortedData.sort(function(entryA, entryB) {
            let countA = dataType === "numerical" ? entryA.value.count : entryA.value;
            let countB = dataType === "numerical" ? entryB.value.count : entryB.value;

            return countA > countB ? 1 : (countB > countA ? -1 : 0);
        });

        // Determine extrema.
        this._cf_extrema[attribute] = {
            min: ((dataType === "numerical") ? sortedData[0].value.count : sortedData[0].value),
            max: ((dataType === "numerical") ? sortedData[sortedData.length - 1].value.count : sortedData[sortedData.length - 1].value)
        };

        // Update extrema by padding values (hardcoded to 10%) for x-axis.
        this._cf_intervals[attribute]   = this._cf_extrema[attribute].max - this._cf_extrema[attribute].min;
        if (this._axisPaddingRatio > 0) {
            this._cf_extrema[attribute].min -= this._cf_intervals[attribute] / this._axisPaddingRatio;
            this._cf_extrema[attribute].max += this._cf_intervals[attribute] / this._axisPaddingRatio;
        }
    }
}