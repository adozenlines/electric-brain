/*
    Electric Brain is an easy to use platform for machine learning.
    Copyright (C) 2016 Electric Brain Software Corporation
    
    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

"use strict";

const async = require('async'),
    fastCSV = require('fast-csv'),
    fs = require('fs'),
    moment = require('moment'),
    mongodb = require('mongodb'),
    path = require('path'),
    Promise = require('bluebird'),
    underscore = require('underscore');

const testingSetMongoURI = "mongodb://localhost:27017/electric_brain_testing";

/**
 * This method returns an enumeration with half the letters of the alphabet, used in many of
 * the generated data sets.
 *
 * @returns {string[]} An array of letters in the enumeration
 */
function getLettersEnumeration()
{
    return ['letter_a', 'letter_b', 'letter_c', 'letter_d', 'letter_e', 'letter_f', 'letter_g', 'letter_h', 'letter_i', 'letter_j', 'letter_k', 'letter_m'];
}


/**
 * Returns a random letter from the letters enumeration
 *
 * @returns {string} The letter
 */
function getRandomLetter()
{
    const letters = getLettersEnumeration();
    return letters[Math.floor(Math.random() * letters.length)];
}


/**
 * This method returns an enumeration with various bogus statuses, used
 * in a bunch of the data sets.
 *
 * @returns {string[]} An array of statuses in the enumeration
 */
function getStatusesEnumeration()
{
    return ['open', 'closed', 'ajar', 'broken', 'fixed'];
}


/**
 * Returns a random status from the statuses enumeration
 *
 * @returns {string} The letter
 */
function getRandomStatus()
{
    const statuses = getStatusesEnumeration();
    return statuses[Math.floor(Math.random() * statuses.length)];
}


/**
 * Returns a random sequence of letters
 *
 * @returns {[object]} The resulting sequence
 */
function getRandomLetterSequence()
{
    const sequenceLength = (Math.random() * 10) + 10;

    const sequence = [];
    for (let item = 0; item < sequenceLength; item += 1)
    {
        sequence.push({letter: getRandomLetter()});
    }
    return sequence;
}


/**
 * Returns a random sequence of both letters and statuses
 *
 * @returns {[object]} The resulting sequence
 */
function getRandomDualSequence()
{
    const sequenceLength = (Math.random() * 10) + 10;

    const sequence = [];
    for (let item = 0; item < sequenceLength; item += 1)
    {
        sequence.push({
            letter: getRandomLetter(),
            status: getRandomStatus()
        });
    }
    return sequence;
}


/**
 * Returns a random sequence of sequences, used for testing multi-layered networks
 *
 * @returns {[object]} The resulting sequence
 */
function getRandomLayeredSequence()
{
    const sequenceLength = (Math.random() * 10) + 10;

    const sequence = [];
    for (let item = 0; item < sequenceLength; item += 1)
    {
        sequence.push({sequence: getRandomLetterSequence()});
    }
    return sequence;
}


/**
 * Returns a random sequence of dual-class sequences.
 *
 * @returns {[object]} The resulting sequence
 */
function getRandomLayeredDualSequence()
{
    const sequenceLength = (Math.random() * 10) + 10;

    const sequence = [];
    for (let item = 0; item < sequenceLength; item += 1)
    {
        sequence.push({sequence: getRandomDualSequence()});
    }
    return sequence;
}


/**
 * Returns a random string. Used testing models that use text
 *
 * @returns {string} The string
 */
function getRandomString()
{
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`~!@#$%^&*()-_=+[{]}oO\'"\\|,<.>/?"';

    let str = '';
    for(let n = 0; n < 30; n += 1)
    {
        str += charset[Math.floor(Math.random() * charset.length)];
    }

    return str;
}

/**
 * This is a convenience method for the below functions for saving their generated testing data sets.
 *
 * @param {string} collectionName The name of the collection to save the objects in
 * @param {[object]} objects The array of objects to save
 *
 * @returns {Promise} A promise that will resolve when the dataset is generated
 */
function saveObjects(collectionName, objects)
{
    return Promise.fromCallback((next) =>
    {
        mongodb.MongoClient.connect(testingSetMongoURI, function(connectError, db)
        {
            if (connectError)
            {
                return next(connectError);
            }

            const collection = db.collection(collectionName);

            collection.removeMany({}, function(err)
            {
                if (err)
                {
                    return next(err);
                }

                // Deep clone each object
                const cloned = objects.map(function(object)
                {
                    return underscore.clone(object);
                });

                collection.insertMany(cloned, function(err)
                {
                    if (err)
                    {
                        return next(err);
                    }

                    return next();
                });
            });
        });
    });
}

/**
 * This is a convenience method for the below functions which takes their dataset and saves
 * it to a CSV file.
 *
 * @param {string} fileName The filename of the CSV file to write to.
 * @param {[object]} objects The array of objects to save
 *
 * @returns {Promise} A promise that will resolve when the dataset is generated
 */
function saveObjectsToCSV(fileName, objects)
{
    return new Promise((resolve, reject) =>
    {
        const csvStream = fastCSV.createWriteStream({headers: true}),
            writableStream = fs.createWriteStream(fileName);

        writableStream.on("finish", function()
        {
            resolve();
        });

        writableStream.on("error", function(err)
        {
            reject(err);
        });

        csvStream.pipe(writableStream);

        objects.forEach((object) =>
        {
            csvStream.write(object);
        });

        csvStream.end();
    });
}


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set is the simplest possible data set. It creates objects
 *  with the same fixed input and output. The network simply has to learn
 *  to copy its input to its output.
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateCopyTestingDataSet = function generateCopyTestingDataSet()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Each object will have a random entry from each enumeration
        const letter = getRandomLetter();
        const object = {
            inputLetter: letter,
            outputLetter: letter
        };

        objects.push(object);
    }

    return saveObjects("copy_value", objects).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "copy_value.csv"), objects);
    });
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This is similar to the copy data set, except that there are two
 *  classifications that it needs to copy
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateDualCopyTestingDataSet = function generateDualCopyTestingDataSet()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Each object will have a random entry from each enumeration
        const letter = getRandomLetter();
        const status = getRandomStatus();
        const object = {
            inputLetter: letter,
            outputLetter: letter,
            inputStatus: status,
            outputStatus: status
        };

        objects.push(object);
    }
    
    return saveObjects("dual_copy_value", objects).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "dual_copy_value.csv"), objects);
    });
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to copy values from input
 *  to output within a sequence.
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateSequenceCopyTestingDataSet = function generateSequenceCopyTestingDataSet()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        const object = {
            letters: getRandomLetterSequence().map(function(item)
            {
                return {
                    inputLetter: item.letter,
                    outputLetter: item.letter
                };
            })
        };

        objects.push(object);
    }

    return saveObjects("sequence_copy", objects);
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to copy two different values from input
 *  to output within a sequence.
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateSequenceDualCopyTestingDataSet = function generateSequenceDualCopyTestingDataSet()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        const object = {
            letters: getRandomDualSequence().map(function(item)
            {
                return {
                    inputLetter: item.letter,
                    outputLetter: item.letter,
                    inputStatus: item.status,
                    outputStatus: item.status
                };
            })
        };

        objects.push(object);
    }

    return saveObjects("sequence_dual_copy", objects);
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to classify a sequence. There is a small,
 *  fixed list of sequences. The network just has to memorize them and learn to
 *  identify which sequence it is.
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateSequenceIdentificationTestingDataSet = function generateSequenceIdentificationTestingDataSet()
{
    const enumerationSequences = [];
    // Generate several random sequences
    for (let sequenceIndex = 0; sequenceIndex < 10; sequenceIndex += 1)
    {
        enumerationSequences.push(getRandomLetterSequence());
    }

    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Choose a random sequence
        const sequenceIndex = Math.floor(Math.random() * enumerationSequences.length);

        const object = {
            inputLetters: enumerationSequences[sequenceIndex],
            outputIdentity: `sequence_${sequenceIndex.toString()}`
        };
        objects.push(object);
    }

    return saveObjects("sequence_identification", objects);
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to classify a sequence. Similar to
 *  generateSequenceIdentificationTestingDataSet, except that instead of
 *  identifying the sequence, it has to produce two randomly assigned classes.
 *  It still requires memorizing the input sequences.
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateSequenceClassificationTestingDataSet = function generateSequenceClassificationTestingDataSet()
{
    const enumerationSequences = [];
    const numberClasses = 10;
    const numberSequences = 15;



    const firstClasses = [
        'class_a',
        'class_b',
        'class_c',
        'class_d',
        'class_e',
        'class_f',
        'class_g',
        'class_h',
        'class_i',
        'class_j',
        'class_k',
        'class_l',
        'class_m'
    ];

    const secondClasses = [
        'class_n',
        'class_o',
        'class_p',
        'class_q',
        'class_r',
        'class_s',
        'class_t',
        'class_u',
        'class_v',
        'class_w',
        'class_x',
        'class_y',
        'class_z'
    ];

    // Generate several random sequences
    for (let sequenceIndex = 0; sequenceIndex < numberSequences; sequenceIndex += 1)
    {
        enumerationSequences.push({
            inputLetters: getRandomLetterSequence(),
            outputFirstClassification: firstClasses[Math.floor((Math.random() * numberClasses) + 1)].toString(),
            outputSecondClassification: secondClasses[Math.floor((Math.random() * numberClasses) + 1)].toString()
        });
    }

    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Choose a random sequence
        const sequenceIndex = Math.floor(Math.random() * enumerationSequences.length);
        objects.push(enumerationSequences[sequenceIndex]);
    }

    return saveObjects("sequence_classification", objects);
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to copy values in a layered
 *  sequence - a sequence of sequences.
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateLayeredSequenceCopyTestingDataSet = function generateLayeredSequenceCopyTestingDataSet()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        const object = {
            letters: getRandomLayeredSequence().map(function(item)
            {
                return {
                    sequence: item.sequence.map(function(innerItem)
                    {
                        return {
                            inputLetter: innerItem.letter,
                            outputLetter: innerItem.letter
                        };
                    })
                };
            })
        };

        objects.push(object);
    }

    return saveObjects("layered_sequence_copy", objects);
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to memorize and identify
 *  layered sequences, which are just sequences of sequences
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateLayeredSequenceIdentificationTestingDataSet = function generateLayeredSequenceIdentificationTestingDataSet()
{
    const enumerationSequences = [];
    // Generate several random sequences
    for (let sequenceIndex = 0; sequenceIndex < 100; sequenceIndex += 1)
    {
        enumerationSequences.push(getRandomLayeredSequence());
    }

    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Choose a random sequence
        const sequenceIndex = Math.floor(Math.random() * enumerationSequences.length);

        const object = {
            inputSequences: enumerationSequences[sequenceIndex],
            outputIdentity: sequenceIndex.toString()
        };
        objects.push(object);
    }

    return saveObjects("layered_sequence_identification", objects);
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to memorize and categorize
 *  layered sequences, which are sequences of sequences. Similar
 *  to generateLayeredSequenceIdentificationTestingDataSet, except that
 *  instead of asking the network to identify the sequence outright,
 *  it has to be able to learn a couple of arbitrarily defined classes
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateLayeredSequenceClassificationTestingDataSet = function generateLayeredSequenceClassificationTestingDataSet()
{
    const enumerationSequences = [];
    const numberClasses = 10;
    const numberSequences = 100;

    const firstClasses = [
        'class_a',
        'class_b',
        'class_c',
        'class_d',
        'class_e',
        'class_f',
        'class_g',
        'class_h',
        'class_i',
        'class_j',
        'class_k',
        'class_l',
        'class_m'
    ];

    const secondClasses = [
        'class_n',
        'class_o',
        'class_p',
        'class_q',
        'class_r',
        'class_s',
        'class_t',
        'class_u',
        'class_v',
        'class_w',
        'class_x',
        'class_y',
        'class_z'
    ];


    // Generate several random sequences
    for (let sequenceIndex = 0; sequenceIndex < numberSequences; sequenceIndex += 1)
    {
        enumerationSequences.push({
            inputLetters: getRandomLayeredSequence(),
            outputFirstClassification: firstClasses[Math.floor((Math.random() * numberClasses) + 1)],
            outputSecondClassification: secondClasses[Math.floor((Math.random() * numberClasses) + 1)]
        });
    }

    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Choose a random sequence
        const sequenceIndex = Math.floor(Math.random() * enumerationSequences.length);
        objects.push(enumerationSequences[sequenceIndex]);
    }

    return saveObjects("layered_sequence_classification", objects);
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to do an inner classification on
 *  a layered sequence - it uses the output of the inner sequence to
 *  help it identify classes on the outer sequence.
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateInnerSequenceClassificationTestingDataSet = function generateInnerSequenceClassificationTestingDataSet()
{
    const enumerationSequences = [];
    const numberSequences = 10;
    // Generate several random sequences
    for (let sequenceIndex = 0; sequenceIndex < numberSequences; sequenceIndex += 1)
    {
        enumerationSequences.push({
            inputInnerSequence: getRandomLetterSequence(),
            outputClassification: sequenceIndex.toString()
        });
    }

    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Choose a random sequence
        const outerSequenceLength = (Math.random() * 10) + 10;
        const outerSequence = [];
        for (let item = 0; item < outerSequenceLength; item += 1)
        {
            const innerSequenceIndex = Math.floor(Math.random() * enumerationSequences.length);
            outerSequence.push(enumerationSequences[innerSequenceIndex]);
        }

        objects.push({sequence: outerSequence});
    }

    return saveObjects("inner_sequence_classification", objects);
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set is used to test the histogram functionality for numbers
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateNumberHistogramDataset = function generateNumberHistogramDataset()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Several random numbers on each object at different orders of magnitude
        const object = {
            first: Number(Math.random()),
            second: Number(Math.random() * 10),
            third: Number(Math.random() * 100),
            fourth: Number(Math.random() * 500),
            fifth: Number(Math.random() * 5000)
        };

        objects.push(object);
    }

    return saveObjects("number_histogram", objects).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "number_histogram.csv"), objects);
    });
};


/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set requires the network to identify a string. Essentially the same as sequence
 *  identification, except that the prepossessing is different
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateStringIdentificationSequence = function generateStringIdentificationSequence()
{
    const enumerationStrings = [];
    // Generate several random strings
    for (let stringIndex = 0; stringIndex < 100; stringIndex += 1)
    {
        enumerationStrings.push(getRandomString());
    }

    const objects = [];
    for (let objectIndex = 0; objectIndex < 1000; objectIndex += 1)
    {
        // Choose a random sequence
        const stringIndex = Math.floor(Math.random() * enumerationStrings.length);

        const object = {
            inputText: enumerationStrings[stringIndex],
            outputIdentity: stringIndex.toString()
        };
        objects.push(object);
    }

    return saveObjects("text_identification", objects);
};



/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set is used to test the ability of the network to predict numbers as
 *  outputs, based on classifications as inputs
 *
 *  @returns {Promise} A promise that will resolve when the dataset is generated
 */
module.exports.generateNumberPredictionFromClassificationDataset = function generateNumberPredictionFromClassificationDataset()
{
    // First, we have a bunch of classifications that are associated with some intrinsic number
    const firstClassification = {
        "first_a": 2,
        "first_b": 3,
        "first_c": 4,
        "first_d": 5,
        "first_e": 6,
        "first_f": 7,
        "first_g": 8,
        "first_h": 9
    };
    const secondClassification = {
        "second_a": 2,
        "second_b": 3,
        "second_c": 4,
        "second_d": 5,
        "second_e": 6,
        "second_f": 7,
        "second_g": 8,
        "second_h": 9
    };

    const objects = [];
    for (let objectIndex = 0; objectIndex < 10000; objectIndex += 1)
    {
        // For each object, we take one of the two classifications, and the network
        // has to learn to predict their product
        const firstClass = Object.keys(firstClassification)[Math.floor(Math.random() * Object.keys(firstClassification).length)];
        const secondClass = Object.keys(secondClassification)[Math.floor(Math.random() * Object.keys(secondClassification).length)];

        const object = {
            first: firstClass,
            second: secondClass,
            result: firstClassification[firstClass] * secondClassification[secondClass]
        };

        objects.push(object);
    }

    return saveObjects("number_prediction_from_classification", objects).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "number_prediction_from_classification.csv"), objects);
    });
};




/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data provides numbers as both inputs and outputs, expecting the network
 *  to learn to do some basic mathematics on the numbers
 *
 *  @returns {Promise} A promise that will resolve when the data set is generated
 */
module.exports.generateNumberMathematicsDataset = function generateNumberMathematicsDataset()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 10000; objectIndex += 1)
    {
        // Generate three random numbers
        const first = Math.floor(Math.random() * 20) + 2;
        const second = Math.floor(Math.random() * 20) + 2;
        const third = Math.floor(Math.random() * 20) + 2;

        const object = {
            first: first,
            second: second,
            third: third,
            product1: first * second,
            product2: first * third,
            product3: second * third,
            sum1: first + second,
            sum2: first + third,
            sum3: second + third
        };

        objects.push(object);
    }

    return saveObjects("number_mathematics", objects).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "number_mathematics.csv"), objects);
    });
};




/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data provides numbers as inputs, and is expected to generate a classification
 *  from those numbers
 *
 *  @returns {Promise} A promise that will resolve when the data set is generated
 */
module.exports.generateNumberClassificationDataset = function generateNumberClassificationDataset()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 10000; objectIndex += 1)
    {
        // Generate two random numbers
        const first = Math.floor(Math.random() * 20) + 2;
        const second = Math.floor(Math.random() * 20) + 2;

        // Create a classification based on their product
        const classification = `class_${Math.floor((first * second) / 25) + 1}`;

        const object = {
            first,
            second,
            classification
        };

        objects.push(object);
    }

    return saveObjects("number_classification", objects).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "number_classification.csv"), objects);
    });
};




/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data provides a date as input and expects the network to classify the date along several dimensions
 *
 *  @returns {Promise} A promise that will resolve when the data set is generated
 */
module.exports.generateDateClassificationDataset = function generateDateClassificationDataset()
{
    const objects = [];
    for (let objectIndex = 0; objectIndex < 10000; objectIndex += 1)
    {
        // First generate a random date, between 1980 and 2015
        const randomDateOffset = Math.random() * 35 * 365 * 24 * 60 * 60 * 1000;
        const randomTimeOffset = Math.random() * 24 * 60 * 60 * 1000;
        const date = moment(new Date(new Date("January 1, 1980").getTime() + randomDateOffset + randomTimeOffset));
        const object = {date: date.toDate()};

        // Create a few derived classifications

        // Is this date on a weekend?
        object.isWeekend = date.day() === 0 || date.day() === 6;

        // Which of the week in the month is it
        const startWeek = Math.floor(moment(date).startOf('month').dayOfYear() / 7);
        object.weekInMonth = `week_${Math.floor(date.dayOfYear() / 7) - startWeek + 1}`;

        // Roughly what time of the day is it?
        if (date.hour() < 5)
        {
            object.timeOfDay = 'late_night';
        }
        else if (date.hour() < 12)
        {
            object.timeOfDay = 'morning';
        }
        else if (date.hour() < 17)
        {
            object.timeOfDay = 'afternoon';
        }
        else if (date.hour() < 23)
        {
            object.timeOfDay = 'evening';
        }
        else
        {
            object.timeOfDay = 'late_night';
        }

        // Which decade is it?
        object.decade = `decade_${Math.floor((date.year() - 1980) / 10) * 10 + 1980}`;

        objects.push(object);
    }

    return saveObjects("date_classification", objects).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "date_classification.csv"), objects);
    });
};




/**
 *  This method is used to generate a data set for testing purposes.
 *
 *  This data set is used for testing the dataset matching functionality
 *
 *  @returns {Promise} A promise that will resolve when the data set is generated
 */
module.exports.generateMatchingTestDataset = function generateMatchingTestDataset()
{
    const letters = getLettersEnumeration();
    const statuses = getStatusesEnumeration();
    let objectIndex = 0;

    let objects = [];
    let linkages = [];

    // Now we systematically generate every possible object
    letters.forEach((firstLetter) =>
    {
        letters.forEach((secondLetter) =>
        {
            letters.forEach((thirdLetter) =>
            {
                statuses.forEach((status) =>
                {
                    // First, give the object two random letters and a random status
                    const object = {
                        link: objectIndex,
                        firstLetter: firstLetter,
                        secondLetter: secondLetter,
                        thirdLetter: thirdLetter,
                        status: status
                    };

                    objects.push(object);

                    // Create a linkage object
                    const linkage = {
                        primaryLink: objectIndex,
                        secondaryLink: objectIndex
                    };

                    linkages.push(linkage);

                    objectIndex += 1;
                });
            });
        });
    });

    return saveObjects("matching_test_primary", objects).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "matching_test_primary.csv"), objects);
    }).then(() =>
    {
        return saveObjects("matching_test_secondary", objects);
    }).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "matching_test_secondary.csv"), objects);
    }).then(() =>
    {
        return saveObjects("matching_linkages", linkages);
    }).then(() =>
    {
        return saveObjectsToCSV(path.join(__dirname, "..", "data", "matching_linkages.csv"), linkages);
    })
};

