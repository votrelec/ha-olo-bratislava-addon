import { DEFAULT_SOURCE_URL, GRAPHQL_URL } from "./constants.ts";
import type { AppSettings, PageMetadata, RawPickupRecord } from "./types.ts";
import { requestJson, requestText } from "./utils.ts";

interface GraphqlPickupResponse {
  data?: {
    pickupDays?: {
      data?: RawPickupRecord[];
    };
  };
}

const PICKUP_DAYS_QUERY = `
query PickupDaysByRegistrationNumber($registrationNumber: String!) {
  pickupDays(filters: {registrationNumber: {eq: $registrationNumber}}) {
    data {
      id
      attributes {
        registrationNumber
        address
        containerVolume
        frequency
        wasteType
        frequencySeason
      }
    }
  }
}
`;

export async function fetchPickupRecords(
  registrationNumber: string,
): Promise<RawPickupRecord[]> {
  const response = await requestJson<GraphqlPickupResponse>(GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      operationName: "PickupDaysByRegistrationNumber",
      query: PICKUP_DAYS_QUERY,
      variables: { registrationNumber },
    }),
  });
  return response.data?.pickupDays?.data ?? [];
}

export async function fetchPageMetadata(sourceUrl: string): Promise<PageMetadata | null> {
  try {
    const html = await requestText(sourceUrl || DEFAULT_SOURCE_URL);
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s);
    if (!match) {
      return null;
    }
    const payload = JSON.parse(match[1]) as {
      props?: {
        pageProps?: {
          entity?: {
            attributes?: {
              updatedAt?: string;
              sections?: Array<{ __typename?: string; dataUpdatedAt?: string }>;
            };
          };
        };
      };
    };
    const entity = payload.props?.pageProps?.entity?.attributes;
    const pickupSection = entity?.sections?.find(
      (section) => section.__typename === "ComponentSectionsPickupDays",
    );
    return {
      pageUpdatedAt: entity?.updatedAt ?? null,
      dataUpdatedAt: pickupSection?.dataUpdatedAt ?? null,
    };
  } catch (error) {
    console.warn("Failed to fetch OLO page metadata", error);
    return null;
  }
}

export async function fetchOloData(settings: AppSettings): Promise<{
  records: RawPickupRecord[];
  address: string | null;
  pageMetadata: PageMetadata | null;
}> {
  const registrationNumber = settings.registrationNumber.trim();
  if (!registrationNumber) {
    throw new Error("Registration number is required.");
  }
  const [records, pageMetadata] = await Promise.all([
    fetchPickupRecords(registrationNumber),
    fetchPageMetadata(settings.sourceUrl),
  ]);
  if (!records.length) {
    throw new Error(`No OLO records found for registration number ${registrationNumber}.`);
  }
  return {
    records,
    address: records[0]?.attributes.address ?? null,
    pageMetadata,
  };
}
