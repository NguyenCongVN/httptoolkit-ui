// Worker.ts
const ctx: Worker = self as any;

import * as serializeError from 'serialize-error';
import { OpenAPIObject } from 'openapi3-ts';
import {
    encodeBuffer,
    decodeBuffer,
    brotliCompress,
    gzip,
    deflate,
    zstdCompress,
    SUPPORTED_ENCODING
} from 'http-encoding';

import { buildApiMetadata, ApiMetadata } from '../model/api/build-openapi';
import { validatePKCS12, ValidationResult } from '../model/crypto';
import { WorkerFormatterKey, formatBuffer } from './ui-worker-formatters';

interface Message {
    id: number;
}

export interface DecodeRequest extends Message {
    type: 'decode';
    buffer: ArrayBuffer;
    encodings: string[];
}

export interface DecodeResponse extends Message {
    error?: Error;
    inputBuffer: ArrayBuffer; // Send the input back, since we transferred it
    decodedBuffer: ArrayBuffer;
}

export interface EncodeRequest extends Message {
    type: 'encode';
    buffer: ArrayBuffer;
    encodings: SUPPORTED_ENCODING[];
}

export interface EncodeResponse extends Message {
    error?: Error;
    encodedBuffer: ArrayBuffer;
}

export interface TestEncodingsRequest extends Message {
    type: 'test-encodings';
    decodedBuffer: Buffer;
}

export interface TestEncodingsResponse extends Message {
    error?: Error;
    encodingSizes: { [encoding: string]: number };
}

export interface BuildApiRequest extends Message {
    type: 'build-api';
    spec: OpenAPIObject;
    baseUrlOverrides?: string[];
}

export interface BuildApiResponse extends Message {
    error?: Error;
    api: ApiMetadata
}

export interface ValidatePKCSRequest extends Message {
    type: 'validate-pkcs12';
    buffer: ArrayBuffer;
    passphrase: string | undefined;
}

export interface ValidatePKCSResponse extends Message {
    error?: Error;
    result: ValidationResult;
}

export interface FormatRequest extends Message {
    type: 'format';
    buffer: ArrayBuffer;
    format: WorkerFormatterKey;
}

export interface FormatResponse extends Message {
    error?: Error;
    formatted: string;
}

export type BackgroundRequest =
    | DecodeRequest
    | EncodeRequest
    | TestEncodingsRequest
    | BuildApiRequest
    | ValidatePKCSRequest
    | FormatRequest;

export type BackgroundResponse =
    | DecodeResponse
    | EncodeResponse
    | TestEncodingsResponse
    | BuildApiResponse
    | ValidatePKCSResponse
    | FormatResponse;

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer =>
    // Have to remember to slice: this can be a view into part of a much larger buffer!
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

async function decodeRequest(request: DecodeRequest): Promise<DecodeResponse> {
    const { id, buffer, encodings } = request;

    const result = await decodeBuffer(buffer, encodings);
    return {
        id,
        inputBuffer: buffer,
        decodedBuffer: bufferToArrayBuffer(result)
    };
}

async function encodeRequest(request: EncodeRequest): Promise<EncodeResponse> {
    const { id, buffer, encodings } = request;

    const result = await encodings.reduce((contentPromise, nextEncoding) => {
        return contentPromise.then((content) =>
            encodeBuffer(content, nextEncoding)
        )
    }, Promise.resolve(Buffer.from(buffer)));

    return {
        id,
        encodedBuffer: bufferToArrayBuffer(result)
    };
}


async function testEncodings(request: TestEncodingsRequest) {
    const { decodedBuffer } = request;

    return {
        id: request.id,
        encodingSizes: {
            'br': (await brotliCompress(decodedBuffer)).length,
            'zstd': (await zstdCompress(decodedBuffer)).length,
            'gzip': (await gzip(decodedBuffer, { level: 9 })).length,
            'deflate': (await deflate(decodedBuffer, { level: 9 })).length
        }
    };
}

async function buildApi(request: BuildApiRequest): Promise<BuildApiResponse> {
    const { id, spec, baseUrlOverrides } = request;
    return { id, api: await buildApiMetadata(spec, baseUrlOverrides) };
}

ctx.addEventListener('message', async (event: { data: BackgroundRequest }) => {
    try {
        console.log('event ' , event)
        switch (event.data.type) {
            case 'decode':
                const decodeResult = await decodeRequest(event.data);
                console.log('result' , decodeResult)
                ctx.postMessage(decodeResult, [
                    decodeResult.inputBuffer,
                    decodeResult.decodedBuffer
                ]);
                break;

            case 'encode':
                const encodeResult = await encodeRequest(event.data);
                ctx.postMessage(encodeResult, [encodeResult.encodedBuffer]);
                break;

            case 'test-encodings':
                const { data } = event;
                ctx.postMessage(await testEncodings(data));
                break;

            case 'build-api':
                ctx.postMessage(await buildApi(event.data));
                break;

            case 'validate-pkcs12':
                const result = validatePKCS12(event.data.buffer, event.data.passphrase);
                ctx.postMessage({ id: event.data.id, result });
                break;

            case 'format':
                const formatted = formatBuffer(event.data.buffer, event.data.format);
                ctx.postMessage({ id: event.data.id, formatted });
                break;

            default:
                console.error('Unknown worker event', event);
        }
    } catch (e) {
        ctx.postMessage({
            id: event.data.id,
            error: serializeError(e)
        });
    }
});