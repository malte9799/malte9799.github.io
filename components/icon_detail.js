var template__icon_detail = /*html*/ `
<div class="z-.1 event fixed inset-0 w-screen overflow-y-auto bg-gray-800 bg-opacity-50">
  <div id="modal" class="flex min-h-full items-start justify-center text-center">
    <div class="mx-6 my-8 w-full max-w-7xl transform rounded-xl bg-gray-900 p-8 text-left shadow-xl transition-all md:mx-auto md:w-[80vw]">
      <div>
        <button id="icon_name" class="group text-[2rem] font-bold text-white transition-colors hover:text-blue-400" aria-label="Copy Icon Name" data-balloon-pos="up"></button>
      </div>
      <div class="mt-12 flex flex-row flex-wrap gap-8">
        <div class="grow-0 basis-full xl:grow xl:basis-0">
          <div class="min-h-[3em] flex-col rounded-2xl bg-[#183153]">
            <div class="relative z-10 flex min-h-[20rem] flex-col items-center justify-center overflow-hidden py-8">
              <img id="preview" class="pointer-events-none flex grow" />
            </div>
          </div>
        </div>
        <div class="grow-0 basis-full xl:grow xl:basis-0">
          <div id="selector" class="flex h-full max-h-[20rem] flex-col justify-center gap-4 md:gap-8"></div>
        </div>
      </div>
      <div id="house" class="mt-8 pt-12 text-start">
        <div>
          <div role="tablist" class="flex flex-row flex-nowrap overflow-clip rounded-t-md bg-slate-800 text-sm font-bold text-white">
            <button role="tab" class="flex flex-row items-center bg-[#183153] px-5 py-3">HTML</button>
            <button role="tab" class="invisible flex flex-row items-center px-5 py-3">SVG</button>
          </div>
        </div>
        <div>
          <button role="tabpanel" id="" class="w-full rounded-b-md bg-[#183153] p-0 text-start [--balloon-color:#146ebe]" aria-label="Copy Code Snippet" data-balloon-pos="up">
            <div class="p-10" id="code"></div>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
`;

class IconDetail {
	constructor() {}

	build_template() {}
}
