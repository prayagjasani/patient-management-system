const natural = require('natural');
const stringSimilarity = require('string-similarity');
const nlp = require('compromise');

// Common medical terms for autocomplete
const commonMedicalTerms = [
    'Hypertension', 'Diabetes', 'Asthma', 'Arthritis', 'Heart Disease',
    'Cancer', 'Stroke', 'Obesity', 'Depression', 'Anxiety',
    'Allergies', 'Migraine', 'Bronchitis', 'Pneumonia', 'Fever',
    'Headache', 'Back Pain', 'Cough', 'Fatigue', 'Nausea',
    'Vomiting', 'Diarrhea', 'Constipation', 'Insomnia', 'Dizziness'
];

// Common treatment protocols
const commonTreatments = [
    'Prescription Medication', 'Physical Therapy', 'Surgery', 'Diet Plan',
    'Exercise Regimen', 'Counseling', 'Vaccination', 'Blood Test',
    'X-Ray', 'MRI', 'CT Scan', 'Ultrasound', 'Biopsy', 'Chemotherapy',
    'Radiation Therapy', 'Antibiotics', 'Pain Management', 'Lifestyle Changes'
];

// Function to get medical term suggestions
function getMedicalTermSuggestions(input) {
    if (!input) return [];

    const matches = commonMedicalTerms.filter(term =>
        term.toLowerCase().includes(input.toLowerCase())
    );

    return matches.slice(0, 5); // Return top 5 matches
}

// Function to get treatment suggestions
function getTreatmentSuggestions(input) {
    if (!input) return [];

    const matches = commonTreatments.filter(treatment =>
        treatment.toLowerCase().includes(input.toLowerCase())
    );

    return matches.slice(0, 5); // Return top 5 matches
}

// Function to analyze medical history and suggest related conditions
function analyzeMedicalHistory(history) {
    if (!history) return [];

    const doc = nlp(history);
    const conditions = doc.match('#Condition+').out('array');
    const symptoms = doc.match('#Symptom+').out('array');

    return {
        conditions: conditions,
        symptoms: symptoms
    };
}

// Function to find similar patient names
function findSimilarNames(name, patients) {
    if (!name || !patients) return [];

    const matches = stringSimilarity.findBestMatch(
        name.toLowerCase(),
        patients.map(p => `${p.first_name} ${p.last_name}`.toLowerCase())
    );

    return matches.ratings
        .filter(r => r.rating > 0.5)
        .map(r => patients[r.targetIndex])
        .slice(0, 3); // Return top 3 matches
}

module.exports = {
    getMedicalTermSuggestions,
    getTreatmentSuggestions,
    analyzeMedicalHistory,
    findSimilarNames
};