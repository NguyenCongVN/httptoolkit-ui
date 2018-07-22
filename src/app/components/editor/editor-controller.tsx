import * as React from 'react';
import * as _ from 'lodash';

import * as monacoEditor from 'monaco-editor';

import { TextEditor } from './text-editor';
import { JsonEditor } from './json-editor';
import { BaseEditor } from './base-editor';

interface EditorBuildArgs {
    editor: React.ReactNode;
    contentTypeSelector: React.ReactNode;
    lineCount: number;
};

interface EditorControllerProps {
    content: string;
    contentType?: string;
    children: (args: EditorBuildArgs) => React.ReactNode;

    options?: monacoEditor.editor.IEditorConstructionOptions;
    onChange?: (newContent: string) => void;
}

interface EditorControllerState {
    selectedContentType: string;
    lineCount: number;
}

interface ContentTypeConfig<E extends typeof BaseEditor = typeof BaseEditor> {
    name: string;
    editor: E;
}

const ContentTypes = {
    "text/plain": { name: "Text", editor: TextEditor },
    "application/json": { name: "JSON", editor: JsonEditor }
} as { [key: string]: ContentTypeConfig };

export class EditorController extends React.PureComponent<EditorControllerProps, EditorControllerState> {
    constructor(props: EditorControllerProps) {
        super(props);

        this.state = {
            selectedContentType: props.contentType || 'text/plain',
            lineCount: this.props.content.split('\n').length
        };
    }

    updateLineCount = (newLineCount: number) => {
        this.setState({
            lineCount: newLineCount
        });
    }

    setContentType = (changeEvent: React.ChangeEvent<HTMLSelectElement>) => {
        let newContentType = changeEvent.target.value;

        this.setState({
            selectedContentType: newContentType
        });
    }

    render() {
        const renderer = this.props.children;
        const {
            selectedContentType,
            lineCount
        } = this.state;

        const contentTypeSelector = <select onChange={this.setContentType}>
            { _.map(ContentTypes, ((typeConfig, contentType) => (
                <option value={contentType} selected={contentType === selectedContentType}>
                    { typeConfig.name }
                </option>
            ))) }
        </select>;

        const EditorClass = ContentTypes[selectedContentType].editor;

        const editor = <EditorClass
            onChange={this.props.onChange}
            onLineCount={this.updateLineCount}
            options={this.props.options}
        >
            { this.props.content }
        </EditorClass>

        return renderer({
            editor,
            contentTypeSelector,
            lineCount
        });
    }
}