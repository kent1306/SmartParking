import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    PutCommand,
    UpdateCommand
} from "@aws-sdk/lib-dynamodb";

import {
    LambdaClient,
    InvokeCommand
} from "@aws-sdk/client-lambda";


const client = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(client);

const lambdaClient = new LambdaClient({});


const spacesTable = "ParkingSpaces";
const eventsTable = "ParkingEvents";


export const handler = async (event) =>
{
    try
    {
        console.log("Parking event received:");
        console.log(event);

        const parkingData =
            event.body
                ? JSON.parse(event.body)
                : event;

        if (
            !parkingData.parkingID ||
            !parkingData.slotID ||
            !parkingData.deviceID ||
            !parkingData.status ||
            !parkingData.timestamp ||
            !parkingData.sensorStatus
        )
        {
            return {
                statusCode: 400,

                body: JSON.stringify({
                    message:
                        "Missing required parking data"
                })
            };
        }


        if (
            parkingData.status !== "occupied" &&
            parkingData.status !== "available"
        )
        {
            return {
                statusCode: 400,

                body: JSON.stringify({
                    message:
                        "Invalid parking status"
                })
            };
        }

        if (
            parkingData.status === "occupied" &&
            !parkingData.plateNumber
        )
        {
            return {
                statusCode: 400,

                body: JSON.stringify({
                    message:
                        "Occupied space requires plateNumber"
                })
            };
        }

        if (
            parkingData.status === "occupied" &&
            parkingData.plateNumber
        )
        {
            await dynamoDB.send(
                new UpdateCommand({
                    TableName: spacesTable,

                    Key: {
                        parkingID:
                            parkingData.parkingID,

                        slotID:
                            parkingData.slotID
                    },

                    UpdateExpression:
                        "SET deviceID = :deviceID, " +
                        "#status = :status, " +
                        "plateNumber = :plateNumber, " +
                        "LEDstatus = :LEDstatus, " +
                        "#timestamp = :timestamp, " +
                        "sensorStatus = :sensorStatus, " +
                        "paymentStatus = :paymentStatus " +
                        "REMOVE permitType, paymentCheckedAt",

                    ExpressionAttributeNames: {
                        "#status": "status",
                        "#timestamp": "timestamp"
                    },

                    ExpressionAttributeValues: {
                        ":deviceID":
                            parkingData.deviceID,

                        ":status":
                            parkingData.status,

                        ":plateNumber":
                            parkingData.plateNumber,

                        ":LEDstatus":
                            parkingData.LEDstatus,

                        ":timestamp":
                            parkingData.timestamp,

                        ":sensorStatus":
                            parkingData.sensorStatus,

                        ":paymentStatus":
                            "checking"
                    }
                })
            );
        }

        else
        {
            await dynamoDB.send(
                new UpdateCommand({
                    TableName: spacesTable,

                    Key: {
                        parkingID:
                            parkingData.parkingID,

                        slotID:
                            parkingData.slotID
                    },

                    UpdateExpression:
                        "SET deviceID = :deviceID, " +
                        "#status = :status, " +
                        "plateNumber = :plateNumber, " +
                        "LEDstatus = :LEDstatus, " +
                        "#timestamp = :timestamp, " +
                        "sensorStatus = :sensorStatus " +
                        "REMOVE paymentStatus, permitType, paymentCheckedAt",

                    ExpressionAttributeNames: {
                        "#status": "status",
                        "#timestamp": "timestamp"
                    },

                    ExpressionAttributeValues: {
                        ":deviceID":
                            parkingData.deviceID,

                        ":status":
                            parkingData.status,

                        ":plateNumber":
                            parkingData.plateNumber || null,

                        ":LEDstatus":
                            parkingData.LEDstatus,

                        ":timestamp":
                            parkingData.timestamp,

                        ":sensorStatus":
                            parkingData.sensorStatus
                    }
                })
            );
        }


        console.log(
            "ParkingSpaces updated"
        );

        const eventID =
            `${parkingData.timestamp}#${parkingData.slotID}`;


        await dynamoDB.send(
            new PutCommand({
                TableName: eventsTable,

                Item: {
                    ...parkingData,
                    eventID: eventID
                }
            })
        );


        console.log(
            "Parking event saved to history"
        );

        if (
            parkingData.status === "occupied" &&
            parkingData.plateNumber
        )
        {
            const paymentEvent =
            {
                parkingID:
                    parkingData.parkingID,

                slotID:
                    parkingData.slotID,

                plateNumber:
                    parkingData.plateNumber
            };


            await lambdaClient.send(
                new InvokeCommand({
                    FunctionName:
                        "PaymentService",

                    InvocationType:
                        "Event",

                    Payload:
                        Buffer.from(
                            JSON.stringify(
                                paymentEvent
                            )
                        )
                })
            );


            console.log(
                "PaymentService triggered"
            );
        }


        // Trigger sensor failure alert
        if (
            parkingData.sensorStatus !== "working"
        )
        {
            const alertEvent =
            {
                parkingID:
                    parkingData.parkingID,

                slotID:
                    parkingData.slotID,

                deviceID:
                    parkingData.deviceID,

                alertType:
                    "sensor_failure",

                sensorStatus:
                    parkingData.sensorStatus
            };


            await lambdaClient.send(
                new InvokeCommand({
                    FunctionName:
                        "AlertService",

                    InvocationType:
                        "Event",

                    Payload:
                        Buffer.from(
                            JSON.stringify(
                                alertEvent
                            )
                        )
                })
            );


            console.log(
                "Sensor failure AlertService triggered"
            );
        }

        return {
            statusCode: 200,

            body: JSON.stringify({
                message:
                    "Parking event saved successfully",

                parkingID:
                    parkingData.parkingID,

                slotID:
                    parkingData.slotID
            })
        };
    }

    catch (error)
    {
        console.log(
            "Error:",
            error
        );

        return {
            statusCode: 500,

            body: JSON.stringify({
                message:
                    "Failed to process parking event",

                error:
                    error.message
            })
        };
    }
};