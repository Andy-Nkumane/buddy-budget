export const privacyPolicyMetadata = {
  version: '0.2-draft',
  preparedDate: '2026-10-18',
  effectiveDate: null,
} as const;

export const privacyPolicyPublicationDetails = {
  responsiblePartyName: null,
  responsiblePartyAddress: null,
  informationOfficerContact: null,
  privacyRequestContact: null,
  approvedLawfulGrounds: null,
  approvedRetentionSchedule: null,
  providerRegionsAndTransferSafeguards: null,
  minimumUserAge: null,
} as const;

const publicationLabels: Record<keyof typeof privacyPolicyPublicationDetails, string> = {
  responsiblePartyName: 'Responsible party legal name',
  responsiblePartyAddress: 'Responsible party address',
  informationOfficerContact: 'Registered Information Officer contact',
  privacyRequestContact: 'Monitored privacy and rights-request contact',
  approvedLawfulGrounds: 'Approved purpose and lawful-ground register',
  approvedRetentionSchedule: 'Approved retention and deletion schedule',
  providerRegionsAndTransferSafeguards: 'Provider regions and international-transfer safeguards',
  minimumUserAge: "Minimum user age and children's-data position",
};

const placeholderPattern = /\b(?:todo|tbc|tbd|unknown|placeholder)\b|^not set$|^<.+>$|^\[.+\]$/i;

const isVerifiedPolicyValue = (value: string | null) => {
  const normalized = value?.trim() ?? '';
  return Boolean(normalized) && !placeholderPattern.test(normalized);
};

export const retrievePrivacyPolicyPublicationBlockers = (
  details: Record<
    keyof typeof privacyPolicyPublicationDetails,
    string | null
  > = privacyPolicyPublicationDetails,
) => [
  ...(privacyPolicyMetadata.effectiveDate ? [] : ['Approved effective date']),
  ...Object.entries(details)
    .filter(([, value]) => !isVerifiedPolicyValue(value))
    .map(([key]) => publicationLabels[key as keyof typeof privacyPolicyPublicationDetails]),
];

export const isPrivacyPolicyPublishable = (
  details: Record<
    keyof typeof privacyPolicyPublicationDetails,
    string | null
  > = privacyPolicyPublicationDetails,
) =>
  Boolean(privacyPolicyMetadata.effectiveDate) &&
  retrievePrivacyPolicyPublicationBlockers(details).length === 0;
