require('torch')
require('nn')

local EBWordEmbedder, parent = torch.class('nn.EBWordEmbedder', 'nn.Container')


-- EBWordEmbedder - handles the tricky task of embedding words in vector space.
-- This will use a combination of learned embeddings and fixed embeddings pulled
-- from a database
function EBWordEmbedder:__init(maxExtraSymbols)
    parent.__init(self)

    -- Keep a lookup table for the remaining words
    self.wordVectors = nn.LookupTable(maxExtraSymbols, 300)

    -- Add the lookup table so the vectors can be learned
    self:add(self.wordVectors)

    -- Set the word mapping
    self.wordMapping = {}
    self.nextWordIndex = 1
end


function EBWordEmbedder:bytesToString(bytes)
    local s = {}
    for i = 1, bytes:size(1) do
        s[i] = string.char(bytes[i])
    end
    return table.concat(s)
end

function EBWordEmbedder:updateOutput(input)
    -- The input must be a table of words. We look up each word in the database
    local vectors = {}

    -- Create an output tensor
    local outputTensor
    if self:type() == 'torch.CudaTensor' then
        outputTensor = torch.zeros(#input, 300):cuda()
    else
        outputTensor = torch.zeros(#input, 300):double()
    end

    local lookupTensor = torch.LongTensor(1)
    for n=1,#input do
        local word = input[n]
        -- This is a hack need to tell the difference between byte-strings and word-vector tensors
        -- The way its currently programmed with the EBNeuralNetworkWordComponent is to provide
        -- single-dimension DoubleTensors containing each character (in byte format). Otherwise,
        -- we assume its a 1x300 Tensor containing the word vector
        if word:nDimension() == 1 then
            -- Create a string from the byte tensor, lookup its index number and get it
            local wordString = self:bytesToString(word)

            local wordIndex = self.wordMapping[wordString]
            if wordIndex == nil then
                wordIndex = self.nextWordIndex
                self.nextWordIndex = self.nextWordIndex + 1
                self.wordMapping[wordString] = wordIndex
            end
            lookupTensor[1] = wordIndex
            outputTensor[n]:copy(self.wordVectors:updateOutput(lookupTensor))
        else
            outputTensor[n]:copy(word)
        end
    end

    return outputTensor
end

function EBWordEmbedder:updateGradInput(input, gradOutput)
    local lookupTensor = torch.LongTensor(1)
    for n=1,#input do
        local word = input[n]
        if word:nDimension() == 1 then
            local wordString = self:bytesToString(word)
            local gradient = gradOutput[n]

            local wordIndex = self.wordMapping[wordString]
            if wordIndex ~= nil then
                lookupTensor[1] = wordIndex
                self.wordVectors:updateGradInput(lookupTensor, gradient)
            end
        end
    end

    self.gradInput = EBWordEmbedder.recursiveEmptyTensor(input)
    return self.gradInput
end



function EBWordEmbedder.recursiveEmptyTensor(t2)
    if torch.type(t2) == 'table' then
        local t1 = {}
        for key,_ in pairs(t2) do
            t1[key] = EBWordEmbedder.recursiveEmptyTensor(t2[key])
        end
        return t1
    elseif torch.isTensor(t2) then
        local t1 = t2.new()
        t1:resizeAs(t2)
        t1:zero()
        return t1
    else
        error("expecting tensor or table thereof. Got "
                ..torch.type(t2).." instead")
    end
end


function EBWordEmbedder:type(type, typecache)
    return parent.type(self, type, typecache)
end
