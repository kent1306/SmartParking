const API_BASE_URL =
    "https://a7fls5fve5.execute-api.us-east-1.amazonaws.com/dev";


const PARKING_EVENT_URL =
    `${API_BASE_URL}/parking-event`;

const PARKING_SPACES_URL =
    `${API_BASE_URL}/parking-spaces`;

const ALERTS_URL =
    `${API_BASE_URL}/alerts`;


// API key is loaded from .env
const API_KEY =
    process.env.SMART_PARKING_API_KEY;


if (!API_KEY)
{
    console.error(
        "ERROR: SMART_PARKING_API_KEY is missing."
    );

    console.error(
        "Run the script using: " +
        "npx dotenv -e .env -- node .\\testdata\\full_pipeline_test.js"
    );

    process.exit(1);
}


const TOTAL_REQUESTS = 20;


// Unique ID for this test run
const runID =
    `FULL-${Date.now()}`;


// ------------------------------------------------
// Send one occupied parking event
// ------------------------------------------------

async function sendParkingEvent(index)
{
    const slotNumber =
        String(index + 1).padStart(2, "0");


    const slotID =
        `${runID}-${slotNumber}`;


    // Alternate between:
    // ABC123 = valid student permit
    // OYF789 = unpaid / no valid permit
    const plateNumber =
        index % 2 === 0
            ? "ABC123"
            : "OYF789";


    const parkingData =
    {
        parkingID: "PARK-A",

        slotID: slotID,

        deviceID:
            `NODE-${slotID}`,

        status: "occupied",

        plateNumber: plateNumber,

        LEDstatus: "red",

        timestamp:
            new Date(
                Date.now() + index
            ).toISOString(),

        sensorStatus: "working"
    };


    const startTime =
        Date.now();


    try
    {
        const response =
            await fetch(
                PARKING_EVENT_URL,
                {
                    method: "POST",

                    headers:
                    {
                        "Content-Type":
                            "application/json",

                        "x-api-key":
                            API_KEY
                    },

                    body:
                        JSON.stringify(
                            parkingData
                        )
                }
            );


        const responseBody =
            await response.text();


        return {
            request:
                index + 1,

            slotID:
                slotID,

            plateNumber:
                plateNumber,

            status:
                response.status,

            duration:
                Date.now() - startTime,

            success:
                response.ok,

            responseBody:
                responseBody
        };
    }

    catch (error)
    {
        return {
            request:
                index + 1,

            slotID:
                slotID,

            plateNumber:
                plateNumber,

            status:
                "ERROR",

            duration:
                Date.now() - startTime,

            success:
                false,

            responseBody:
                error.message
        };
    }
}


// ------------------------------------------------
// Wait helper
// ------------------------------------------------

function wait(ms)
{
    return new Promise(
        resolve =>
            setTimeout(resolve, ms)
    );
}


// ------------------------------------------------
// Get dashboard API data
// ------------------------------------------------

async function getJson(url)
{
    const response =
        await fetch(url);


    if (!response.ok)
    {
        const body =
            await response.text();

        throw new Error(
            `GET ${url} failed: ` +
            `${response.status} ${body}`
        );
    }


    return await response.json();
}


// ------------------------------------------------
// Check downstream services
// ------------------------------------------------

async function verifyPipeline()
{
    console.log(
        "\nWaiting for asynchronous services..."
    );


    let finalResult =
    {
        spaces: 0,
        valid: 0,
        unpaid: 0,
        alerts: 0
    };


    // Check every 2 seconds
    // Maximum observation window = 16 seconds
    for (
        let attempt = 1;
        attempt <= 8;
        attempt++
    )
    {
        await wait(2000);


        try
        {
            const parkingResult =
                await getJson(
                    PARKING_SPACES_URL
                );


            const alertResult =
                await getJson(
                    ALERTS_URL
                );


            // Only records created by THIS run
            const testSpaces =
                (
                    parkingResult.data ||
                    []
                ).filter(
                    space =>
                        space.parkingID ===
                            "PARK-A" &&

                        space.slotID &&
                        space.slotID.startsWith(
                            runID
                        )
                );


            const validPayments =
                testSpaces.filter(
                    space =>
                        space.paymentStatus ===
                            "valid"
                );


            const unpaidPayments =
                testSpaces.filter(
                    space =>
                        space.paymentStatus ===
                            "unpaid"
                );


            // Only unpaid_vehicle alerts
            // created by THIS run
            const matchingAlerts =
                (
                    alertResult.data ||
                    []
                ).filter(
                    alert =>
                        alert.parkingID ===
                            "PARK-A" &&

                        alert.slotID &&
                        alert.slotID.startsWith(
                            runID
                        ) &&

                        alert.alertType ===
                            "unpaid_vehicle"
                );


            // Count unique unpaid slots
            // to avoid duplicate alerts
            // incorrectly increasing the result
            const uniqueAlertSlots =
                new Set(
                    matchingAlerts.map(
                        alert =>
                            alert.slotID
                    )
                );


            finalResult =
            {
                spaces:
                    testSpaces.length,

                valid:
                    validPayments.length,

                unpaid:
                    unpaidPayments.length,

                alerts:
                    uniqueAlertSlots.size
            };


            console.log(
                `Check ${attempt}: ` +
                `${finalResult.spaces}/20 spaces, ` +
                `${finalResult.valid} valid, ` +
                `${finalResult.unpaid} unpaid, ` +
                `${finalResult.alerts} alerts`
            );


            if (
                finalResult.spaces === 20 &&
                finalResult.valid === 10 &&
                finalResult.unpaid === 10 &&
                finalResult.alerts === 10
            )
            {
                break;
            }
        }

        catch (error)
        {
            console.log(
                `Check ${attempt} failed:`,
                error.message
            );
        }
    }


    console.log(
        "\nFull Pipeline Verification"
    );


    console.log(
        "Parking records:",
        finalResult.spaces,
        "/ 20"
    );


    console.log(
        "Valid payments:",
        finalResult.valid,
        "/ 10"
    );


    console.log(
        "Unpaid payments:",
        finalResult.unpaid,
        "/ 10"
    );


    console.log(
        "Alerts created:",
        finalResult.alerts,
        "/ 10"
    );


    const passed =
        finalResult.spaces === 20 &&
        finalResult.valid === 10 &&
        finalResult.unpaid === 10 &&
        finalResult.alerts === 10;


    if (passed)
    {
        console.log(
            "\nFULL PIPELINE TEST PASSED"
        );
    }
    else
    {
        console.log(
            "\nFULL PIPELINE TEST INCOMPLETE"
        );

        process.exitCode = 1;
    }
}


// ------------------------------------------------
// Run test
// ------------------------------------------------

async function runTest()
{
    console.log(
        `Full pipeline test: ` +
        `${TOTAL_REQUESTS} concurrent events`
    );


    console.log(
        `Run ID: ${runID}\n`
    );


    const startTime =
        Date.now();


    const requests = [];


    for (
        let i = 0;
        i < TOTAL_REQUESTS;
        i++
    )
    {
        requests.push(
            sendParkingEvent(i)
        );
    }


    const results =
        await Promise.all(
            requests
        );


    const totalTime =
        Date.now() - startTime;


    const successful =
        results.filter(
            result =>
                result.success
        ).length;


    const failed =
        TOTAL_REQUESTS -
        successful;


    const averageDuration =
        results.reduce(
            (
                sum,
                result
            ) =>
                sum +
                result.duration,
            0
        ) /
        TOTAL_REQUESTS;


    // Short table for terminal output
    console.table(
        results.map(
            result => ({
                request:
                    result.request,

                slotID:
                    result.slotID,

                plateNumber:
                    result.plateNumber,

                status:
                    result.status,

                duration:
                    result.duration,

                success:
                    result.success
            })
        )
    );


    console.log(
        "\nRequest Summary"
    );


    console.log(
        "Total requests:",
        TOTAL_REQUESTS
    );


    console.log(
        "Successful:",
        successful
    );


    console.log(
        "Failed:",
        failed
    );


    console.log(
        "Total test time:",
        totalTime,
        "ms"
    );


    console.log(
        "Average request duration:",
        averageDuration.toFixed(2),
        "ms"
    );


    // Print failed response bodies
    // only when something went wrong
    if (failed > 0)
    {
        console.log(
            "\nFailed Request Details"
        );


        results
            .filter(
                result =>
                    !result.success
            )
            .forEach(
                result =>
                {
                    console.log(
                        `Request ${result.request}: ` +
                        `${result.status} - ` +
                        `${result.responseBody}`
                    );
                }
            );
    }


    // Do not continue pipeline verification
    // if the initial requests failed
    if (successful !== TOTAL_REQUESTS)
    {
        console.log(
            "\nPipeline verification skipped " +
            "because not all requests succeeded."
        );

        process.exitCode = 1;

        return;
    }


    await verifyPipeline();
}


runTest()
    .catch(
        error =>
        {
            console.error(
                "Unexpected test error:",
                error
            );

            process.exitCode = 1;
        }
    );