import * as React from 'react';
import { inject, observer } from 'mobx-react';

import { styled } from '../../styles';

import { InterceptionStore } from '../../model/interception-store';
import {
    HandlerClass,
    Handler,
    HandlerClassKey,
    HandlerKeys,
    HandlerLookup
} from '../../model/rules/rules';
import { summarizeHandlerClass } from '../../model/rules/rule-descriptions';
import {
    StaticResponseHandler,
    ForwardToHostHandler,
    RequestBreakpointHandler,
    ResponseBreakpointHandler,
    RequestAndResponseBreakpointHandler,
    PassThroughHandler
} from '../../model/rules/rule-definitions';

import { Select } from '../common/inputs';

const getHandlerKey = (h: HandlerClass | Handler) =>
    HandlerKeys.get(h as any) || HandlerKeys.get(h.constructor as any);
const getHandlerClassByKey = (k: HandlerClassKey) => HandlerLookup[k];

const HandlerOptions = (p: { handlers: Array<HandlerClass> }) => <>{
    p.handlers.map((handler): JSX.Element | null => {
        const key = getHandlerKey(handler);
        const description = summarizeHandlerClass(handler);

        return description
            ? <option key={key} value={key}>
                { description }
            </option>
            : null;
    })
}</>;

const HandlerSelect = styled(Select)`
    margin-top: 20px;
`;

const instantiateHandler = (
    handlerClass: HandlerClass,
    interceptionStore: InterceptionStore
): Handler | undefined => {
    switch (handlerClass) {
        case StaticResponseHandler:
            return new StaticResponseHandler(200);
        case PassThroughHandler:
            return new PassThroughHandler(interceptionStore.whitelistedCertificateHosts);
        case ForwardToHostHandler:
            return new ForwardToHostHandler('');
        case RequestBreakpointHandler:
            return new RequestBreakpointHandler(interceptionStore);
        case ResponseBreakpointHandler:
            return new ResponseBreakpointHandler(interceptionStore);
        case RequestAndResponseBreakpointHandler:
            return new RequestAndResponseBreakpointHandler(interceptionStore);
    }
}

export const HandlerSelector = inject('interceptionStore')(observer((p: {
    interceptionStore?: InterceptionStore,
    value: Handler,
    onChange: (handler: Handler) => void
}) => {
    return <HandlerSelect
        value={getHandlerKey(p.value)}
        onChange={(event) => {
            const handlerClass = getHandlerClassByKey(event.target.value as HandlerClassKey);
            const handler = instantiateHandler(handlerClass, p.interceptionStore!);
            if (!handler) return;
            p.onChange(handler);
        }}
    >
        <HandlerOptions handlers={[
            StaticResponseHandler,
            PassThroughHandler,
            ForwardToHostHandler,
            RequestBreakpointHandler,
            ResponseBreakpointHandler,
            RequestAndResponseBreakpointHandler
        ]} />
    </HandlerSelect>
}));