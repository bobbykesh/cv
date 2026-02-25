// --- CONFIGURATION ---
// Set PDF.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// --- STATE MANAGEMENT ---
const state = {
    experience: [],
    education: []
};

// --- NAVIGATION ---
function showPage(pageId) {
    document.getElementById('page-home').style.display = pageId === 'home' ? 'block' : 'none';
    document.getElementById('page-builder').style.display = pageId === 'builder' ? 'block' : 'none';
    window.scrollTo(0, 0);
}

function switchTab(tabName) {
    document.querySelectorAll('.form-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Highlight button hack
    const buttons = document.querySelectorAll('.tab');
    if(tabName === 'personal') buttons[0].classList.add('active');
    if(tabName === 'experience') buttons[1].classList.add('active');
    if(tabName === 'education') buttons[2].classList.add('active');
}

// --- FILE UPLOAD & PARSING ---
async function handleFileUpload(input) {
    const file = input.files[0];
    if (!file) return;

    // Show Loader
    document.getElementById('loader').style.display = 'flex';

    try {
        let text = '';
        
        if (file.type === 'application/pdf') {
            text = await extractTextFromPDF(file);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            text = await extractTextFromDocx(file);
        } else {
            alert('Please upload a PDF or DOCX file.');
            return;
        }

        // Parse extracted text
        parseAndPopulate(text);
        
        // Go to builder
        showPage('builder');
        
    } catch (error) {
        console.error(error);
        alert('Error parsing file. Please try another.');
    } finally {
        document.getElementById('loader').style.display = 'none';
        input.value = ''; // Reset input
    }
}

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }
    return fullText;
}

async function extractTextFromDocx(file) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

function parseAndPopulate(text) {
    // 1. Basic Regex Extraction
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/;
    const phoneRegex = /((?:\+|00)[1-9][0-9 \-\(\)\.]{7,32})|(0\d{10})/;
    
    const emailMatch = text.match(emailRegex);
    const phoneMatch = text.match(phoneRegex);

    // 2. Populate Personal Info
    if (emailMatch) document.getElementById('input-email').value = emailMatch[0];
    if (phoneMatch) document.getElementById('input-phone').value = phoneMatch[0];

    // Attempt Name Guess (First 2-3 words)
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length > 0) {
        const firstLine = lines[0];
        if (firstLine.split(' ').length < 5) {
            document.getElementById('input-name').value = firstLine;
        }
    }

    // 3. Populate Summary (First chunk of text)
    // Naive approach: take first 300 chars that aren't the name
    const summaryText = text.slice(0, 500).replace(/\s+/g, ' ').trim();
    document.getElementById('input-summary').value = summaryText;

    // 4. Heuristic Section Extraction (Experience)
    // Look for lines with years like "2020" or "Present"
    const yearRegex = /\b(20\d{2}|19\d{2}|Present|Current)\b/i;
    state.experience = []; // Reset
    
    // Scan lines for potential job entries
    for(let i=0; i<lines.length; i++) {
        const line = lines[i];
        if (yearRegex.test(line) && line.length < 50) {
            // Found a date line? Likely a job header.
            // Check line before for Title
            const prevLine = lines[i-1] || "Job Role";
            
            state.experience.push({
                id: Date.now() + i,
                title: prevLine,
                company: "Extracted from CV", 
                date: line,
                desc: "Description extracted from uploaded file."
            });
        }
    }

    // Update UI
    renderExperienceInputs();
    renderExperiencePreview();
    updatePreview();
    alert('CV Parsed! Please review the extracted data.');
}

// --- LIVE PREVIEW LOGIC ---
function updatePreview() {
    const map = {
        'input-name': 'preview-name',
        'input-title': 'preview-title',
        'input-email': 'preview-email',
        'input-phone': 'preview-phone',
        'input-location': 'preview-location',
        'input-summary': 'preview-summary'
    };

    for (const [inputId, previewId] of Object.entries(map)) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);
        if (input && preview) {
            preview.innerText = input.value || preview.getAttribute('data-placeholder') || '';
            if(inputId === 'input-summary') {
                document.getElementById('section-summary').style.display = input.value ? 'block' : 'none';
            }
        }
    }
}

// --- DYNAMIC SECTIONS (Experience) ---
function addExperience() {
    const id = Date.now();
    state.experience.push({ id, title: '', company: '', date: '', desc: '' });
    renderExperienceInputs();
    renderExperiencePreview();
}

function updateExperience(id, field, value) {
    const item = state.experience.find(x => x.id === id);
    if(item) {
        item[field] = value;
        renderExperiencePreview();
    }
}

function removeExperience(id) {
    state.experience = state.experience.filter(x => x.id !== id);
    renderExperienceInputs();
    renderExperiencePreview();
}

function renderExperienceInputs() {
    const container = document.getElementById('experience-list');
    container.innerHTML = '';

    state.experience.forEach(exp => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="form-group">
                <input type="text" placeholder="Job Title" value="${exp.title}" oninput="updateExperience(${exp.id}, 'title', this.value)">
            </div>
            <div class="form-group">
                <input type="text" placeholder="Company Name" value="${exp.company}" oninput="updateExperience(${exp.id}, 'company', this.value)">
            </div>
            <div class="form-group">
                <input type="text" placeholder="Dates (e.g. 2020 - Present)" value="${exp.date}" oninput="updateExperience(${exp.id}, 'date', this.value)">
            </div>
            <div class="form-group">
                <textarea placeholder="Job description..." rows="3" oninput="updateExperience(${exp.id}, 'desc', this.value)">${exp.desc}</textarea>
            </div>
            <button class="btn btn-outline small" onclick="removeExperience(${exp.id})" style="color: red; border-color: red;">Remove</button>
        `;
        container.appendChild(div);
    });
}

function renderExperiencePreview() {
    const container = document.getElementById('preview-experience-list');
    container.innerHTML = '';

    state.experience.forEach(exp => {
        // if(!exp.title && !exp.company) return; 
        const div = document.createElement('div');
        div.className = 'cv-item';
        div.innerHTML = `
            <div class="cv-item-header">
                <span>${exp.title}</span>
                <span>${exp.date}</span>
            </div>
            <div class="cv-item-sub">${exp.company}</div>
            <p>${exp.desc.replace(/\n/g, '<br>')}</p>
        `;
        container.appendChild(div);
    });
}

// --- DYNAMIC SECTIONS (Education) ---
function addEducation() {
    const id = Date.now();
    state.education.push({ id, school: '', degree: '', date: '' });
    renderEducationInputs();
    renderEducationPreview();
}

function updateEducation(id, field, value) {
    const item = state.education.find(x => x.id === id);
    if(item) {
        item[field] = value;
        renderEducationPreview();
    }
}

function removeEducation(id) {
    state.education = state.education.filter(x => x.id !== id);
    renderEducationInputs();
    renderEducationPreview();
}

function renderEducationInputs() {
    const container = document.getElementById('education-list');
    container.innerHTML = '';

    state.education.forEach(edu => {
        const div = document.createElement('div');
        div.className = 'item-card';
        div.innerHTML = `
            <div class="form-group">
                <input type="text" placeholder="School / University" value="${edu.school}" oninput="updateEducation(${edu.id}, 'school', this.value)">
            </div>
            <div class="form-group">
                <input type="text" placeholder="Degree / Certificate" value="${edu.degree}" oninput="updateEducation(${edu.id}, 'degree', this.value)">
            </div>
            <div class="form-group">
                <input type="text" placeholder="Graduation Year" value="${edu.date}" oninput="updateEducation(${edu.id}, 'date', this.value)">
            </div>
            <button class="btn btn-outline small" onclick="removeEducation(${edu.id})" style="color: red; border-color: red;">Remove</button>
        `;
        container.appendChild(div);
    });
}

function renderEducationPreview() {
    const container = document.getElementById('preview-education-list');
    container.innerHTML = '';

    state.education.forEach(edu => {
        if(!edu.school) return;
        const div = document.createElement('div');
        div.className = 'cv-item';
        div.innerHTML = `
            <div class="cv-item-header">
                <span>${edu.school}</span>
                <span>${edu.date}</span>
            </div>
            <div class="cv-item-sub">${edu.degree}</div>
        `;
        container.appendChild(div);
    });
}

// --- EXPORT PDF ---
function downloadPDF() {
    const element = document.getElementById('cv-document');
    const opt = {
        margin: 0,
        filename: 'my-perfect-cv.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
}

// --- LOCAL STORAGE ---
function saveData() {
    const inputs = document.querySelectorAll('input, textarea');
    const data = {};
    inputs.forEach(input => {
        if(input.id && input.id !== 'cv-upload') data[input.id] = input.value;
    });
    data.experience = state.experience;
    data.education = state.education;
    localStorage.setItem('cvData', JSON.stringify(data));
    alert('Saved to browser!');
}

function loadData() {
    const saved = localStorage.getItem('cvData');
    if(!saved) return;
    const data = JSON.parse(saved);
    for (const [key, value] of Object.entries(data)) {
        if(key === 'experience' || key === 'education') continue;
        const el = document.getElementById(key);
        if(el) el.value = value;
    }
    if(data.experience) {
        state.experience = data.experience;
        renderExperienceInputs();
        renderExperiencePreview();
    }
    if(data.education) {
        state.education = data.education;
        renderEducationInputs();
        renderEducationPreview();
    }
    updatePreview();
}

window.addEventListener('DOMContentLoaded', loadData);
