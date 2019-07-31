import {
    Component,
    ViewChild,
    ElementRef,
    OnInit,
    OnChanges,
    OnDestroy,
    Input,
    ChangeDetectionStrategy,
    forwardRef,
    SimpleChanges,
    Output,
    AfterViewInit
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, Validator, NG_VALIDATORS, ValidationErrors } from '@angular/forms';
import { filter, take } from 'rxjs/operators';
import { editor } from 'monaco-editor';

import { MonacoEditorLoaderService } from '../../services/monaco-editor-loader.service';
import { Subject, Observable } from 'rxjs';

declare const monaco: any;

@Component({
    selector: 'ngx-monaco-editor',
    template: `<div #container materiaResized (resized)="onResized($event)" class="editor-container" fxFlex>
	<div class="wrapper">
		<div
			#editor
			class="monaco-editor"
			[style.width.px]="container.offsetWidth"
			[style.height.px]="container.offsetHeight" style="min-width: 0;"
		></div>
	</div>
</div>`,
    styles: [
        `:host {
	flex: 1;
	box-sizing: border-box;
	flex-direction: column;
	display: flex;
	overflow: hidden;
	max-width: 100%;
	min-wdith: 0;
}
.wrapper {
	width: 0px; height: 0px;
}
.editor-container {
	text-overflow: ellipsis;
	overflow: hidden;
	position: relative;
	min-width: 0;
	display: table;
	width: 100%;
	height: 100%;
}`
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => MonacoEditorComponent),
            multi: true
        },
        {
            provide: NG_VALIDATORS,
            useExisting: forwardRef(() => MonacoEditorComponent),
            multi: true,
        }
    ]
})
export class MonacoEditorComponent implements AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor, Validator {
    @Input() options: editor.IEditorConstructionOptions;
    @ViewChild('editor', { static: false }) editorContent: ElementRef;

    container: HTMLDivElement;
    editor: editor.IStandaloneCodeEditor;
    value: string;
    parseError: boolean;

    private onTouched: () => void;
    private onErrorStatusChange: () => void;
    private propagateChange: (_: any) => any = (_: any) => { };

    constructor(private monacoLoader: MonacoEditorLoaderService) { }

    ngAfterViewInit() {
        this.container = this.editorContent.nativeElement;
        this.monacoLoader.isMonacoLoaded.pipe(
            filter(isLoaded => isLoaded),
            take(1)
        ).subscribe(() => {
            this.initMonaco();
        });
    }

    ngOnChanges(changes: SimpleChanges) {
        if (this.editor && changes.options && !changes.options.firstChange) {
            if (changes.options.previousValue.language !== changes.options.currentValue.language) {
                monaco.editor.setModelLanguage(
                    this.editor.getModel(),
                    this.options && this.options.language ? this.options.language : 'text'
                );
            }
            if (changes.options.previousValue.theme !== changes.options.currentValue.theme) {
                monaco.editor.setTheme(changes.options.currentValue.theme);
            }
            if (changes.options.previousValue.readOnly !== changes.options.currentValue.readOnly) {
                this.editor.updateOptions({ readOnly: changes.options.currentValue.readOnly });
            }
        }
    }

    writeValue(value: string): void {
        this.value = value;
        if (this.editor && value) {
            this.editor.setValue(value);
        } else if (this.editor) {
            this.editor.setValue('');
        }
    }

    registerOnChange(fn: any): void {
        this.propagateChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    validate(): ValidationErrors {
        return (!this.parseError) ? null : {
            parseError: {
                valid: false,
            }
        };
    }

    registerOnValidatorChange?(fn: () => void): void {
        this.onErrorStatusChange = fn;
    }

    private initMonaco() {
        let opts: editor.IEditorConstructionOptions = {
            value: [this.value].join('\n'),
            language: 'text',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            theme: 'vc'
        };

        if (this.options) {
            opts = Object.assign({}, opts, this.options);
        }

        this.editor = monaco.editor.create(this.container, opts);
        this.editor.layout();

        this.editor.onDidChangeModelContent(e => {
            this._contentChanged.next(e);
            this.propagateChange(this.editor.getValue());
        });

        this.editor.onDidChangeModelDecorations(() => {
            const pastParseError = this.parseError;
            if (monaco.editor.getModelMarkers({}).map(m => m.message).join(', ')) {
                this.parseError = true;
            } else {
                this.parseError = false;
            }

            if (pastParseError !== this.parseError) {
                this._errorStateChanged.next(this.parseError);
                this.onErrorStatusChange();
            }
        });

        this.editor.onDidBlurEditorText(() => {
            this._touched.next();
            this.onTouched();
        });


        alert('stuff!');
        this._ready.next();
    }

    private _errorStateChanged = new Subject<boolean>();

    @Output()
    get errorStateChanged(): Observable<boolean> {
        return this._errorStateChanged;
    }

    private _ready = new Subject<void>();
    
    @Output()
    get ready(): Observable<void> {
        return this._ready;
    }

    private _contentChanged = new Subject<editor.IModelContentChangedEvent>();

    @Output()
    get contentChanged(): Observable<editor.IModelContentChangedEvent> {
        return this._contentChanged;
    }

    private _touched = new Subject<void>();

    @Output()
    get touched(): Observable<void> {
        return this._touched;
    }

    onResized(event) {
        if (this.editor) {
            this.editor.layout({
                width: event.newWidth,
                height: event.newHeight
            });
        }
    }

    ngOnDestroy() {
        if (this.editor) {
            this.editor.dispose();
        }
    }
}
