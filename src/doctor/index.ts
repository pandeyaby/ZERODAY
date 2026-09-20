export {
  LOCAL_BRAIN_DOCS,
  ANTARES_RECOMMENDED_DOCS,
  ANTARES_LOCAL_DOCS,
  CHAT_ONLY_REFUSED,
  QUALITY_HONESTY,
  checkLocalBrainEndpointShape,
  formatLocalBrainDoctorChecklist,
  type LocalBrainEndpointCheck,
} from "./local-brain";

export {
  DOCTOR_SCHEMA,
  DOCTOR_REPO_ROOT,
  DOCTOR_REQUIRED_SCRIPTS,
  runDoctor,
  doctorCatalog,
  formatDoctorBanner,
  type DoctorCheck,
  type DoctorResult,
  type RunDoctorOptions,
} from "./workstation";
