/**
 * Dropdown options for the salary estimator form.
 *
 * Generated from employee_salary_dataset_10000.csv
 *
 * Conventions
 * - Ordinal fields (Job_Level, Education_Level, Company_Size) keep their natural
 *   progression, lowest to highest. Do not sort them alphabetically.
 * - Every other field is listed alphabetically so options are easy to scan.
 * - Values must match the training data exactly; the model treats them as
 *   categories, so a typo or a renamed value is an unseen category.
 */

/* -------------------------------------------------------------------------- */
/*  Role                                                                       */
/* -------------------------------------------------------------------------- */

const JOB_TITLE = [
  "Academic Coordinator",
  "Accountant",
  "Accounts Assistant",
  "Administrative Officer",
  "Backend Developer",
  "Brand Manager",
  "Business Analyst",
  "Business Development Executive",
  "Call Center Agent",
  "Civil Engineer",
  "Content Writer",
  "Credit Officer",
  "Customer Support Representative",
  "Cybersecurity Analyst",
  "Data Analyst",
  "Data Scientist",
  "Database Administrator",
  "DevOps Engineer",
  "Digital Marketing Specialist",
  "Electrical Engineer",
  "Executive Assistant",
  "Financial Analyst",
  "Frontend Developer",
  "Full Stack Developer",
  "HR Generalist",
  "HR Officer",
  "Healthcare Administrator",
  "IT Support Specialist",
  "Internal Auditor",
  "Key Account Manager",
  "Lab Technician",
  "Lecturer",
  "Logistics Coordinator",
  "Machine Learning Engineer",
  "Machine Operator",
  "Maintenance Technician",
  "Marketing Executive",
  "Mechanical Engineer",
  "Medical Officer",
  "Mobile App Developer",
  "Network Engineer",
  "Office Assistant",
  "Operations Executive",
  "Payroll Specialist",
  "Pharmacist",
  "Procurement Officer",
  "Production Engineer",
  "Production Supervisor",
  "Project Coordinator",
  "QA Engineer",
  "Quality Engineer",
  "Quality Inspector",
  "Receptionist",
  "Recruiter",
  "Relationship Manager",
  "Sales Executive",
  "School Teacher",
  "Software Engineer",
  "Staff Nurse",
  "Supply Chain Analyst",
  "Telecom Engineer",
  "Treasury Analyst",
  "UI/UX Designer",
  "Warehouse Supervisor",
];

const JOB_FAMILY = [
  "Administration & Support",
  "Education",
  "Engineering",
  "Finance & Accounting",
  "Healthcare",
  "Human Resources",
  "Information Technology",
  "Manufacturing",
  "Operations & Supply Chain",
  "Sales & Marketing",
];

/** Ordinal: lowest to highest. */
const JOB_LEVEL = [
  "Junior",
  "Mid-level",
  "Senior",
  "Lead",
  "Manager",
  "Director",
  "Executive",
];

const DEPARTMENT = [
  "Academics",
  "Administration",
  "Clinical",
  "Engineering",
  "Finance",
  "HR",
  "IT",
  "Marketing",
  "Operations",
  "Production",
  "Sales",
];

const INDUSTRY = [
  "Banking & Finance",
  "Construction & Real Estate",
  "Education",
  "Energy & Oil/Gas",
  "FMCG & Retail",
  "Government / Public Sector",
  "Healthcare",
  "Hospitality & Services",
  "Logistics & Transport",
  "Manufacturing & Textile",
  "NGO / Development",
  "Pharmaceuticals",
  "Technology & Software",
  "Telecommunications",
];

/* -------------------------------------------------------------------------- */
/*  Education                                                                  */
/* -------------------------------------------------------------------------- */

/** Ordinal: lowest to highest. */
const EDUCATION_LEVEL = [
  "Intermediate",
  "Diploma",
  "Bachelor's",
  "Master's",
  "MPhil",
  "PhD",
];

const FIELD_OF_STUDY = [
  "Accounting & Finance",
  "Arts",
  "Business Administration",
  "Business Diploma",
  "Chemical Engineering",
  "Civil Engineering",
  "Commerce",
  "Computer Science",
  "Data Science",
  "Diploma of Associate Engineer (DAE)",
  "Economics",
  "Education",
  "Electrical Engineering",
  "English",
  "HR Management",
  "Health Administration",
  "Industrial Engineering",
  "Industrial Technology",
  "Information Technology",
  "Marketing",
  "Mass Communication",
  "Mathematics",
  "Mechanical Engineering",
  "Medical Lab Technology",
  "Medicine (MBBS)",
  "Nursing",
  "Pharmacy (Pharm-D)",
  "Physics",
  "Pre-Engineering",
  "Pre-Medical",
  "Psychology",
  "Software Engineering",
  "Supply Chain Management",
  "Technical Diploma",
  "Telecommunication Engineering",
  "Textile Engineering",
];

/* -------------------------------------------------------------------------- */
/*  Management and employer                                                    */
/* -------------------------------------------------------------------------- */

const MANAGEMENT_RESPONSIBILITY = ["No", "Yes"];

/** Ordinal: smallest to largest. */
const COMPANY_SIZE = ["Small", "Medium", "Large", "Enterprise"];

const COMPANY_TYPE = [
  "Government",
  "Multinational",
  "Nonprofit / NGO",
  "Private Limited",
  "Public Listed",
  "Startup",
];

/* -------------------------------------------------------------------------- */
/*  Work arrangement                                                           */
/* -------------------------------------------------------------------------- */

const EMPLOYMENT_TYPE = ["Contract", "Full-time", "Part-time", "Temporary"];

const REMOTE_WORK_TYPE = ["Hybrid", "On-site", "Remote"];

/**
 * Maps each city to its province or territory. The form uses this to keep
 * `Region` in sync with `City`, so the two can never disagree.
 */
export const CITY_REGION: Record<string, string> = {
  Faisalabad: "Punjab",
  Hyderabad: "Sindh",
  Islamabad: "Islamabad Capital Territory",
  Karachi: "Sindh",
  Lahore: "Punjab",
  Multan: "Punjab",
  Peshawar: "Khyber Pakhtunkhwa",
  Quetta: "Balochistan",
  Rawalpindi: "Punjab",
  Sialkot: "Punjab",
};

/** City options derived from CITY_REGION so the two lists cannot drift apart. */
const CITY = Object.keys(CITY_REGION).sort((a, b) => a.localeCompare(b));

/* -------------------------------------------------------------------------- */
/*  Public exports                                                             */
/* -------------------------------------------------------------------------- */

/** Options for every dropdown, keyed by feature name (matches `SalaryFeatures`). */
export const OPTIONS: Record<string, string[]> = {
  Job_Title: JOB_TITLE,
  Job_Family: JOB_FAMILY,
  Job_Level: JOB_LEVEL,
  Department: DEPARTMENT,
  Industry: INDUSTRY,
  Education_Level: EDUCATION_LEVEL,
  Field_of_Study: FIELD_OF_STUDY,
  Management_Responsibility: MANAGEMENT_RESPONSIBILITY,
  Company_Size: COMPANY_SIZE,
  Company_Type: COMPANY_TYPE,
  Employment_Type: EMPLOYMENT_TYPE,
  Remote_Work_Type: REMOTE_WORK_TYPE,
  City: CITY,
};

/** Returns the region for a city, or `fallback` when the city is unknown. */
export function getRegion(city: string, fallback = ""): string {
  return CITY_REGION[city] ?? fallback;
}

/** True when `value` is a valid option for `key`. Useful for validating saved or imported data. */
export function isValidOption(key: string, value: string): boolean {
  return OPTIONS[key]?.includes(value) ?? false;
}