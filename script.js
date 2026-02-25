// --- STATE MANAGEMENT ---
const state = {
    experience: [],
    education: []
};

// --- NAVIGATION ---
function showPage(pageId) {
    document.getElementById('page-home').style.display = pageId === 'home' ? 'block' : 'none';
    document.getElementById('page-builder').style.display = pageId === 'builder' ? 'block' : 'none';
    
    // Smooth scroll to top
    window.scrollTo(0, 0);
}

function switchTab(tabName) {
    // Hide all sections
    document.querySelectorAll('.form-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

    // Show selected
    document.getElementById(`tab-${tabName}`).classList.add('active');
    
    // Highlight button
    // Find the button that called this function would be cleaner, but simple loop works:
    const buttons = document.querySelectorAll('.tab');
    if(tabName === 'personal') buttons[0].classList.add('active');
    if(tabName === 'experience') buttons[1].classList.add('active');
    if(tabName === 'education') buttons[2].classList.add('active');
}

// --- LIVE PREVIEW LOGIC ---
function updatePreview() {
    // Personal Info Mappings
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
            // Handle empty summary visibility
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
        if(!exp.title && !exp.company) return; // Don't show empty blocks
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
// (Simplified version of Experience logic)
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
    
    // Options for html2pdf
    const opt = {
        margin: 0,
        filename: 'my-perfect-cv.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Use html2pdf library (loaded via CDN in index.html)
    html2pdf().set(opt).from(element).save();
}

// --- LOCAL STORAGE ---
function saveData() {
    // Save Inputs
    const inputs = document.querySelectorAll('input, textarea');
    const data = {};
    inputs.forEach(input => {
        if(input.id) data[input.id] = input.value;
    });
    
    // Save Arrays
    data.experience = state.experience;
    data.education = state.education;

    localStorage.setItem('cvData', JSON.stringify(data));
    alert('Saved to browser!');
}

function loadData() {
    const saved = localStorage.getItem('cvData');
    if(!saved) return;

    const data = JSON.parse(saved);

    // Restore Inputs
    for (const [key, value] of Object.entries(data)) {
        if(key === 'experience' || key === 'education') continue;
        const el = document.getElementById(key);
        if(el) el.value = value;
    }

    // Restore Arrays
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

// Load data on startup
window.addEventListener('DOMContentLoaded', loadData);
